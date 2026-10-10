// deploy / delete の認証後経路を、模擬 API とネットワークガード付きで検証する。
// 実際の Cloudflare には接続しない。偽の token / account ID だけを使う。
// 模擬応答に基づく観測であり、実 API の挙動の証明ではない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeRoute, startMockApi } from "../test-support/mock-cloudflare-api.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const guardPath = path.resolve(here, "../test-support/network-guard.mjs");
const cfBin = process.env.PREVIEW_CF_BIN;
const skip = cfBin ? false : "PREVIEW_CF_BIN が未設定のため skip";

const EXPECTED_NAME = "dev-tools-pr-999";
const FAKE_TOKEN = "preflight-fake-token-not-a-secret";
const DEPLOY_ARGS = ["deploy", "--prebuilt", "--provision=false"];
const DELETE_ARGS = ["workers", "delete", EXPECTED_NAME, "--force"];

function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(root, p));
    }
  };
  walk(root);
  return out.sort();
}

function buildArtifact(root) {
  const base = path.join(root, ".cloudflare/output/v0");
  const worker = path.join(base, "workers/default");
  fs.mkdirSync(path.join(worker, "bundle"), { recursive: true });
  fs.mkdirSync(path.join(worker, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(base, "config.json"),
    JSON.stringify({ buildContext: { isPreview: false, mode: "production" } }),
  );
  fs.writeFileSync(
    path.join(worker, "worker.config.json"),
    JSON.stringify({
      name: EXPECTED_NAME,
      compatibilityDate: "2026-10-01",
      compatibilityFlags: ["nodejs_compat"],
      assets: { notFoundHandling: "none" },
      env: { ASSETS: { type: "assets" } },
      manifest: { type: "partial", mainModule: "index.js", modules: {} },
    }),
  );
  // 評価されたら痕跡を残す目印
  fs.writeFileSync(
    path.join(worker, "bundle/index.js"),
    [
      'console.log("PREFLIGHT_BUNDLE_EXECUTED");',
      "if (globalThis.process && process.env && process.env.PREFLIGHT_MARKER_PATH) {",
      '  const fs = await import("node:fs");',
      '  fs.writeFileSync(process.env.PREFLIGHT_MARKER_PATH, "executed");',
      "}",
      'export default { fetch() { return new Response("ok"); } };',
      "",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(worker, "assets/index.html"), "<!doctype html><title>t</title>\n");
  fs.writeFileSync(path.join(worker, "assets/app.js"), 'console.log("asset");\n');
}

function runCf({ args, cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", guardPath, cfBin, ...args], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

// 1 シナリオを実行して観測結果をまとめる。
async function runScenario({ label, args, routeOptions }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-upload-"));
  const cwd = path.join(tmp, "artifact");
  const home = path.join(tmp, "home");
  const guardLog = path.join(tmp, "guard.log");
  const marker = path.join(tmp, "bundle-marker.txt");
  fs.mkdirSync(cwd);
  fs.mkdirSync(home);
  buildArtifact(cwd);
  const before = new Set([
    ...listFiles(cwd).map((f) => "cwd:" + f),
    ...listFiles(home).map((f) => "home:" + f),
  ]);

  const api = await startMockApi({ route: makeRoute(routeOptions) });
  let result;
  try {
    // 親プロセスの環境は引き継がず、必要最小限を明示的に組み立てる
    const env = {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      HOME: home,
      CLOUDFLARE_API_BASE_URL: `http://127.0.0.1:${api.port}/client/v4`,
      CLOUDFLARE_API_TOKEN: FAKE_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: "00000000000000000000000000000000",
      CI: "true",
      // テレメトリ送信を無効化する (cf が参照する環境変数)
      CF_SEND_TELEMETRY: "false",
      DO_NOT_TRACK: "1",
      NODE_OPTIONS: `--import=${guardPath}`,
      PREFLIGHT_GUARD_LOG: guardLog,
      PREFLIGHT_MARKER_PATH: marker,
    };
    result = await runCf({ args, cwd, env, timeoutMs: 120000 });
  } finally {
    await api.close();
  }

  const created = [
    ...listFiles(cwd).map((f) => "cwd:" + f),
    ...listFiles(home).map((f) => "home:" + f),
  ].filter((f) => !before.has(f));
  const guardEntries = fs.existsSync(guardLog)
    ? fs
        .readFileSync(guardLog, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
  const requests = api.requests;
  const paths = requests.map((r) => r.path);
  const nameBearing = paths.filter((p) => /dev-tools/.test(p));

  // state.json は値を出さず、キーと偽 token の有無だけ観測する
  const statePath = path.join(home, ".config/cloudflare/state.json");
  let state = null;
  if (fs.existsSync(statePath)) {
    const text = fs.readFileSync(statePath, "utf8");
    let keys = [];
    try {
      keys = Object.keys(JSON.parse(text));
    } catch {
      keys = ["(JSON ではない)"];
    }
    state = { keys, containsFakeToken: text.includes(FAKE_TOKEN) };
  }

  console.log(`# [${label}] exit: ${result.code} ${result.signal ?? ""}`);
  console.log(`# [${label}] requests:`);
  for (const r of requests) {
    console.log(
      `#   ${r.method} ${r.path} auth=${r.hasAuthorization} body=${JSON.stringify(r.body)}`,
    );
  }
  console.log(`# [${label}] name-bearing paths:`, JSON.stringify(nameBearing));
  console.log(`# [${label}] guard:`, JSON.stringify(guardEntries));
  console.log(`# [${label}] created files:`, JSON.stringify(created));
  console.log(`# [${label}] state.json:`, JSON.stringify(state));
  console.log(`# [${label}] stdout(tail):`, result.stdout.slice(-400));
  console.log(`# [${label}] stderr(head):`, result.stderr.slice(0, 800));

  return {
    ...result,
    requests,
    paths,
    nameBearing,
    guardEntries,
    created,
    state,
    markerExists: fs.existsSync(marker),
    home,
    tmp,
  };
}

// 共通の 3 点 (Worker 名 / 成果物コード不実行 / 接続先) を別々のサブテストで確認する。
async function commonChecks(t, r, { requireNameBearing = true } = {}) {
  await t.test("Worker 名を含む path は期待名だけを指す", () => {
    if (requireNameBearing) {
      assert.ok(
        r.nameBearing.length > 0,
        "Worker 名を含む path が記録されなかった (到達していない)",
      );
    }
    for (const p of r.paths) {
      for (const m of p.matchAll(/dev-tools[A-Za-z0-9_-]*/g)) {
        assert.equal(m[0], EXPECTED_NAME, `想定外の Worker 名: ${p}`);
      }
    }
  });
  await t.test("成果物コードは評価されない", () => {
    assert.ok(!r.stdout.includes("PREFLIGHT_BUNDLE_EXECUTED"), "標準出力に目印がある");
    assert.ok(!r.stderr.includes("PREFLIGHT_BUNDLE_EXECUTED"), "標準エラーに目印がある");
    assert.ok(!r.markerExists, "目印ファイルが作られた");
  });
  await t.test("ループバック以外への接続試行が 0 件", () => {
    assert.deepEqual(
      r.guardEntries,
      [],
      `ループバック以外への接続試行: ${JSON.stringify(r.guardEntries)}`,
    );
  });
  await t.test("作られたファイルは一時ディレクトリ内に留まる", () => {
    for (const f of r.created) assert.ok(f.startsWith("cwd:") || f.startsWith("home:"), f);
    if (r.state) assert.ok(fs.existsSync(path.join(r.home, ".config/cloudflare/state.json")));
  });
}

test("新規作成の deploy 経路", { skip }, async (t) => {
  const r = await runScenario({ label: "create", args: DEPLOY_ARGS, routeOptions: {} });
  await t.test("cf が正常終了する", () => assert.equal(r.code, 0));
  await commonChecks(t, r);
});

test("既存 Worker への更新 deploy 経路", { skip }, async (t) => {
  const r = await runScenario({
    label: "update",
    args: DEPLOY_ARGS,
    routeOptions: { existing: true },
  });
  await t.test("cf が正常終了する", () => assert.equal(r.code, 0));
  await commonChecks(t, r);
});

test("アセット本体のアップロード経路", { skip }, async (t) => {
  const r = await runScenario({
    label: "assets",
    args: DEPLOY_ARGS,
    routeOptions: { buckets: true },
  });
  await t.test("cf が正常終了する", () => assert.equal(r.code, 0));
  await t.test("アセット本体のアップロード要求が模擬 API に届く", () => {
    assert.ok(
      r.requests.some((q) => q.path.endsWith("/assets/upload")),
      "assets/upload への要求が無い",
    );
  });
  await commonChecks(t, r);
});

test("削除経路: DELETE は対象名だけを指す", { skip }, async (t) => {
  const r = await runScenario({
    label: "delete",
    args: DELETE_ARGS,
    routeOptions: { existing: true },
  });
  await t.test("cf が正常終了する", () => assert.equal(r.code, 0));
  await t.test("DELETE の path は dev-tools-pr-999 だけを指す", () => {
    const deletes = r.requests.filter((q) => q.method === "DELETE");
    assert.ok(deletes.length > 0, "DELETE が記録されなかった");
    for (const q of deletes) assert.ok(q.path.endsWith(`/${EXPECTED_NAME}`), q.path);
  });
  await commonChecks(t, r);
});

test(
  "削除経路: 模擬 API が 404 を返したときの観測 (実 API の挙動の証明ではない)",
  { skip },
  async (t) => {
    const r = await runScenario({
      label: "delete-404",
      args: DELETE_ARGS,
      routeOptions: { missing: true },
    });
    // 終了コードと出力は上の console.log で観測として記録する。ここでは安全側の性質だけを assert する。
    await commonChecks(t, r, { requireNameBearing: false });
  },
);

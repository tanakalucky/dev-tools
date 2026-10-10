// preview-cleanup が実行する削除処理(delete-preview.sh)の送信先を、ループバックの模擬 API で確かめる。
// 本物の Cloudflare には接続しない(network-guard でループバック以外を遮断し、試行を記録する)。
// wrangler の版を上げるときは、このテストの成功を条件とする。
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "delete-preview.sh");
const guard = path.join(here, "test-support/network-guard.mjs");
const ACCOUNT = "0123456789abcdef0123456789abcdef";
const PREVIEWS = `/client/v4/accounts/${ACCOUNT}/workers/workers/dev-tools/previews/`;

// 受け取ったリクエストの method と path だけを記録し、status で応答する模擬 API。
async function startMockApi(status) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method, path: req.url });
    req.resume();
    req.on("end", () => {
      const ok = status < 400;
      res.writeHead(status, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          success: ok,
          errors: ok ? [] : [{ code: 10000, message: "mock error" }],
          messages: [],
          result: ok ? null : undefined,
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, requests, base: `http://127.0.0.1:${server.address().port}/client/v4` };
}

// workflow の削除 step と同じスクリプトを、wrangler 設定の無い一時ディレクトリで起動する。
function runDelete(base, previewName) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "preview-delete-"));
  const guardLog = path.join(cwd, "guard.log");
  const env = {
    PATH: process.env.PATH,
    HOME: cwd,
    CI: "true",
    NODE_OPTIONS: `--import=${guard}`,
    NETWORK_GUARD_LOG: guardLog,
    CLOUDFLARE_API_BASE_URL: base,
    CLOUDFLARE_API_TOKEN: "fake-token-for-loopback-only",
    CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
    PREVIEW_NAME: previewName,
  };
  return new Promise((resolve) => {
    // 確認待ちなどで止まった場合に CI の上限まで待たないよう、30 秒で打ち切る。
    const child = spawn(script, [], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", (error) => resolve({ code: null, output: String(error), blocked: "" }));
    child.on("close", (code) => {
      const blocked = fs.existsSync(guardLog) ? fs.readFileSync(guardLog, "utf8").trim() : "";
      resolve({ code, output, blocked });
    });
  });
}

for (const [name, encoded] of [
  ["feat/json-formatter", "feat%2Fjson-formatter"],
  ["fix#12", "fix%2312"],
]) {
  test(`ブランチ名 ${name} の Preview だけを DELETE し、Worker 本体には触れない`, async () => {
    const api = await startMockApi(200);
    try {
      const { code, output, blocked } = await runDelete(api.base, name);
      assert.equal(code, 0, output);
      assert.equal(blocked, "", "ループバック以外への接続が試みられた");
      assert.deepEqual(api.requests, [{ method: "DELETE", path: PREVIEWS + encoded }]);
    } finally {
      api.server.close();
    }
  });
}

// `..` は wrangler の URL で `previews/` を打ち消し、Worker 本体の DELETE になる(4.149.0 で確認)。
for (const name of ["..", ".", "-x", "a/../b"]) {
  test(`ブランチ名として不正な ${name} では何も送らずに失敗する`, async () => {
    const api = await startMockApi(200);
    try {
      const { code, blocked } = await runDelete(api.base, name);
      assert.notEqual(code, 0);
      assert.equal(blocked, "", "ループバック以外への接続が試みられた");
      assert.deepEqual(api.requests, []);
    } finally {
      api.server.close();
    }
  });
}

// deploy と削除が共有する名前検査(check-preview-name.sh)を直接呼ぶ表テスト。
const checkScript = path.join(here, "check-preview-name.sh");
function runCheck(name) {
  return spawnSync("bash", [checkScript, name], { encoding: "utf8", timeout: 30_000 });
}

for (const name of ["feat/json-formatter", "fix#12", "main"]) {
  test(`名前検査は ${name} を受理する`, () => {
    assert.equal(runCheck(name).status, 0);
  });
}

for (const name of ["", ".", "..", "-x", "a/../b", "@{-1}", "a b"]) {
  test(`名前検査は ${JSON.stringify(name)} を拒否する`, () => {
    assert.equal(runCheck(name).status, 1);
  });
}

test("API が失敗を返したら非 0 で終了する(run の失敗として報告される)", async () => {
  const api = await startMockApi(404);
  try {
    const { code, blocked } = await runDelete(api.base, "already-gone");
    assert.notEqual(code, 0);
    assert.equal(blocked, "", "ループバック以外への接続が試みられた");
    // 失敗時の wrangler は token の確認(GET)を追加で送る。変更を伴うリクエストは Preview の DELETE だけであること。
    assert.deepEqual(
      api.requests.filter((r) => r.method !== "GET"),
      [{ method: "DELETE", path: PREVIEWS + "already-gone" }],
    );
  } finally {
    api.server.close();
  }
});

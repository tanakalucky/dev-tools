// preview-cleanup が実行する `wrangler preview delete` の送信先を、ループバックの模擬 API で確かめる。
// 本物の Cloudflare には接続しない(network-guard でループバック以外を遮断し、試行を記録する)。
// wrangler の版を上げるときは、このテストの成功を条件とする。
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const wranglerBin = path.join(here, "node_modules/wrangler/bin/wrangler.js");
const guard = path.join(here, "test-support/network-guard.mjs");
const ACCOUNT = "0123456789abcdef0123456789abcdef";

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

// workflow の削除 step と同じ引数で wrangler を起動する。cwd は wrangler 設定の無い一時ディレクトリ。
function runDelete(base, previewName) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "preview-delete-"));
  const guardLog = path.join(cwd, "guard.log");
  const env = {
    PATH: process.env.PATH,
    HOME: cwd,
    CI: "true",
    NODE_OPTIONS: `--import=${guard}`,
    PREFLIGHT_GUARD_LOG: guardLog,
    CLOUDFLARE_API_BASE_URL: base,
    CLOUDFLARE_API_TOKEN: "fake-token-for-loopback-only",
    CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
    WRANGLER_SEND_METRICS: "false",
    // banner を出すと npm registry への更新確認が走るため止める(workflow と同じ指定)。
    WRANGLER_HIDE_BANNER: "true",
  };
  const args = [
    wranglerBin,
    "preview",
    "delete",
    "--worker-name",
    "dev-tools",
    `--name=${previewName}`,
    "--skip-confirmation",
  ];
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) => {
      const blocked = fs.existsSync(guardLog) ? fs.readFileSync(guardLog, "utf8").trim() : "";
      resolve({ code, output, blocked });
    });
  });
}

test("ブランチ名の Preview だけを DELETE し、Worker 本体には触れない", async () => {
  const api = await startMockApi(200);
  try {
    const { code, output, blocked } = await runDelete(api.base, "feat/json-formatter");
    assert.equal(code, 0, output);
    assert.equal(blocked, "", "ループバック以外への接続が試みられた");
    assert.deepEqual(api.requests, [
      {
        method: "DELETE",
        path: `/client/v4/accounts/${ACCOUNT}/workers/workers/dev-tools/previews/feat%2Fjson-formatter`,
      },
    ]);
  } finally {
    api.server.close();
  }
});

test("API が失敗を返したら非 0 で終了する(run の失敗として報告される)", async () => {
  const api = await startMockApi(404);
  try {
    const { code, blocked } = await runDelete(api.base, "already-gone");
    assert.notEqual(code, 0);
    assert.equal(blocked, "", "ループバック以外への接続が試みられた");
    assert.ok(
      api.requests.some((r) => r.method === "DELETE" && r.path.endsWith("/previews/already-gone")),
    );
  } finally {
    api.server.close();
  }
});

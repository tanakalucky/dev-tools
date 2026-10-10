import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  MAX_CONFIG_BYTES,
  rewriteWorkerConfig,
  validateArtifact,
  writeSyntheticArtifact,
} from "./artifact.mjs";

const WORKER = ".cloudflare/output/v0/workers/default";

async function withDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "preview-artifact-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const goodWorker = () => ({
  name: "dev-tools",
  compatibilityDate: "2026-10-01",
  compatibilityFlags: ["nodejs_compat"],
  assets: { notFoundHandling: "none" },
  env: { ASSETS: { type: "assets" } },
  manifest: { type: "partial", mainModule: "index.js", modules: {} },
});

async function rejectsWorker(patch, label) {
  await withDir(async (dir) => {
    await writeSyntheticArtifact(dir, { workerConfig: patch(goodWorker()) });
    await assert.rejects(validateArtifact(dir), undefined, label);
  });
}

test("合成の成果物を受理し、名前を書き換える", async () => {
  await withDir(async (dir) => {
    await writeSyntheticArtifact(dir);
    await validateArtifact(dir);
    await rewriteWorkerConfig(dir, "dev-tools-pr-9");
    const raw = await readFile(path.join(dir, WORKER, "worker.config.json"), "utf8");
    assert.equal(JSON.parse(raw).name, "dev-tools-pr-9");
    assert.ok(!raw.includes('"dev-tools"'));
  });
});

test("不正な名前では書き換えない", async () => {
  await withDir(async (dir) => {
    await writeSyntheticArtifact(dir);
    for (const name of ["dev-tools", "", "dev-tools-pr-01"]) {
      await assert.rejects(rewriteWorkerConfig(dir, name));
    }
    const raw = JSON.parse(await readFile(path.join(dir, WORKER, "worker.config.json"), "utf8"));
    assert.equal(raw.name, "dev-tools");
  });
});

test("name 以外の本番名が残る場合は拒否する", async () => {
  await rejectsWorker((c) => ((c.manifest.mainModule = "dev-tools"), c), "存在しない mainModule");
});

test("シンボリックリンクを拒否する", async () => {
  await withDir(async (dir) => {
    await writeSyntheticArtifact(dir);
    await symlink("/etc/hostname", path.join(dir, WORKER, "assets/link.txt"));
    await assert.rejects(validateArtifact(dir));
  });
  await withDir(async (dir) => {
    await writeSyntheticArtifact(dir);
    await symlink(".", path.join(dir, WORKER, "bundle/loop"));
    await assert.rejects(validateArtifact(dir));
  });
});

test("想定外のトップレベルやファイルを拒否する", async () => {
  const extras = [
    "cloudflare.config.ts",
    ".cloudflare/extra.json",
    ".cloudflare/output/v0/extra.json",
    ".cloudflare/output/v0/workers/other/worker.config.json",
    `${WORKER}/extra.js`,
  ];
  for (const extra of extras) {
    await withDir(async (dir) => {
      await writeSyntheticArtifact(dir);
      const file = path.join(dir, extra);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "{}");
      await assert.rejects(validateArtifact(dir), undefined, extra);
    });
  }
});

test("bundle と assets の配下の入れ子は許可する", async () => {
  await withDir(async (dir) => {
    await writeSyntheticArtifact(dir);
    await mkdir(path.join(dir, WORKER, "assets/_next/static"), { recursive: true });
    await writeFile(path.join(dir, WORKER, "assets/_next/static/a.js"), "x");
    await writeFile(path.join(dir, WORKER, "vinext-externals.json"), "[]");
    await validateArtifact(dir);
  });
});

test("config.json の許可リスト", async () => {
  const bad = [
    { buildContext: { isPreview: false, mode: "production" }, accountId: "x" },
    { buildContext: { isPreview: true, mode: "production" } },
    { buildContext: { isPreview: false, mode: "development" } },
    { buildContext: { isPreview: false, mode: "production", account: "x" } },
    {},
  ];
  for (const buildConfig of bad) {
    await withDir(async (dir) => {
      await writeSyntheticArtifact(dir, { buildConfig });
      await assert.rejects(validateArtifact(dir), undefined, JSON.stringify(buildConfig));
    });
  }
});

test("worker.config.json の拒否ケース", async () => {
  const cases = {
    routes: (c) => ((c.routes = ["example.com/*"]), c),
    triggers: (c) => ((c.triggers = { crons: ["* * * * *"] }), c),
    containers: (c) => ((c.containers = [{}]), c),
    account: (c) => ((c.accountId = "abc"), c),
    "KV binding": (c) => ((c.env.KV = { type: "kv", id: "x" }), c),
    "ASSETS 以外の型": (c) => ((c.env.ASSETS = { type: "kv" }), c),
    "ASSETS の余分なキー": (c) => ((c.env.ASSETS = { type: "assets", extra: 1 }), c),
    日付: (c) => ((c.compatibilityDate = "2026-1-1"), c),
    日付なし: (c) => (delete c.compatibilityDate, c),
    フラグ: (c) => ((c.compatibilityFlags = ["nodejs_als"]), c),
    フラグが文字列: (c) => ((c.compatibilityFlags = "nodejs_compat"), c),
    "assets の余分なキー": (c) => ((c.assets.binding = "X"), c),
    "notFoundHandling が非文字列": (c) => ((c.assets.notFoundHandling = 1), c),
    "manifest の型": (c) => ((c.manifest.type = "full"), c),
    "manifest の余分なキー": (c) => ((c.manifest.extra = 1), c),
    "modules が非空": (c) => ((c.manifest.modules = { "a.js": "x" }), c),
    "mainModule の traversal": (c) => ((c.manifest.mainModule = "../index.js"), c),
    "mainModule の途中 traversal": (c) => ((c.manifest.mainModule = "a/../index.js"), c),
    "mainModule が絶対パス": (c) => ((c.manifest.mainModule = "/etc/passwd"), c),
    "mainModule が不在": (c) => ((c.manifest.mainModule = "missing.js"), c),
    "name が非文字列": (c) => ((c.name = 1), c),
    __proto__: (c) => JSON.parse('{"__proto__": {}, "compatibilityDate": "2026-10-01"}'),
  };
  for (const [label, patch] of Object.entries(cases)) {
    await rejectsWorker(patch, label);
  }
});

test("巨大な設定ファイルと壊れた JSON を拒否する", async () => {
  await withDir(async (dir) => {
    await writeSyntheticArtifact(dir);
    await writeFile(
      path.join(dir, WORKER, "worker.config.json"),
      JSON.stringify({ ...goodWorker(), pad: "x".repeat(MAX_CONFIG_BYTES) }),
    );
    await assert.rejects(validateArtifact(dir));
    await writeFile(path.join(dir, WORKER, "worker.config.json"), "{not json");
    await assert.rejects(validateArtifact(dir));
  });
});

test("重複キーは再構築により検査済みの値だけが残る", async () => {
  await withDir(async (dir) => {
    await writeSyntheticArtifact(dir);
    const dup =
      '{"name":"x","name":"dev-tools","compatibilityDate":"2026-10-01","manifest":{"type":"partial","mainModule":"index.js","modules":{}}}';
    await writeFile(path.join(dir, WORKER, "worker.config.json"), dup);
    await rewriteWorkerConfig(dir, "dev-tools-pr-3");
    const raw = await readFile(path.join(dir, WORKER, "worker.config.json"), "utf8");
    assert.equal(raw.match(/"name"/g).length, 1);
    assert.ok(!raw.includes('"dev-tools"'));
  });
});

test("assets 配下のファイル数上限は定数で守られる", async () => {
  const { MAX_FILES } = await import("./artifact.mjs");
  assert.ok(Number.isInteger(MAX_FILES) && MAX_FILES > 0);
});

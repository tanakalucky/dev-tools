// ビルド成果物の許可リスト検査と、検査済みの値だけでの設定の再構築。

import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertPreviewWorkerName } from "./names.mjs";

export const MAX_FILES = 5000;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_CONFIG_BYTES = 64 * 1024;

const OUTPUT = ".cloudflare/output";
const WORKER = `${OUTPUT}/v0/workers/default`;
const ALLOWED_DIRS = new Set([
  "",
  ".cloudflare",
  OUTPUT,
  `${OUTPUT}/v0`,
  `${OUTPUT}/v0/workers`,
  WORKER,
  `${WORKER}/bundle`,
  `${WORKER}/assets`,
]);
const ALLOWED_FILES = new Set([
  `${OUTPUT}/v0/config.json`,
  `${WORKER}/worker.config.json`,
  `${WORKER}/vinext-externals.json`,
]);

export class ArtifactError extends Error {}
const fail = (message) => {
  throw new ArtifactError(message);
};

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function assertKeys(obj, allowed, label) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) fail(`${label} に許可されていないキーがあります`);
  }
}

function underAllowedTree(rel) {
  return rel.startsWith(`${WORKER}/bundle/`) || rel.startsWith(`${WORKER}/assets/`);
}

/** lstat で成果物を歩き、構成・種類・件数・サイズを検査する。 */
async function walk(root) {
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory()) fail("成果物のルートがディレクトリではありません");
  let files = 0;
  let bytes = 0;
  const stack = [""];
  while (stack.length > 0) {
    const rel = stack.pop();
    const entries = await readdir(path.join(root, rel));
    for (const name of entries) {
      if (name === ".." || name === "." || name.includes("\0")) fail("不正なパス名があります");
      const childRel = rel === "" ? name : `${rel}/${name}`;
      const st = await lstat(path.join(root, childRel));
      if (st.isSymbolicLink()) fail("シンボリックリンクは許可されていません");
      if (st.isDirectory()) {
        if (!ALLOWED_DIRS.has(childRel) && !underAllowedTree(childRel)) {
          fail("想定外のディレクトリがあります");
        }
        stack.push(childRel);
      } else if (st.isFile()) {
        if (!ALLOWED_FILES.has(childRel) && !underAllowedTree(childRel)) {
          fail("想定外のファイルがあります");
        }
        files += 1;
        bytes += st.size;
        if (files > MAX_FILES) fail("ファイル数が上限を超えています");
        if (bytes > MAX_TOTAL_BYTES) fail("総サイズが上限を超えています");
      } else {
        fail("通常ファイルとディレクトリ以外は許可されていません");
      }
    }
  }
  for (const required of [`${WORKER}/bundle`, `${WORKER}/assets`]) {
    const st = await lstat(path.join(root, required)).catch(() => null);
    if (!st?.isDirectory()) fail("bundle または assets がありません");
  }
  return { files, bytes };
}

async function readJson(file) {
  const st = await lstat(file).catch(() => null);
  if (!st?.isFile()) fail("設定ファイルがありません");
  if (st.size > MAX_CONFIG_BYTES) fail("設定ファイルが大きすぎます");
  let value;
  try {
    value = JSON.parse(await readFile(file, "utf8"));
  } catch {
    fail("設定ファイルが JSON として不正です");
  }
  if (!isPlainObject(value)) fail("設定ファイルの形式が不正です");
  return value;
}

function sanitizeBuildConfig(obj) {
  assertKeys(obj, ["buildContext"], "config.json");
  const ctx = obj.buildContext;
  if (!isPlainObject(ctx)) fail("buildContext がありません");
  assertKeys(ctx, ["isPreview", "mode"], "buildContext");
  if (ctx.isPreview !== false || ctx.mode !== "production") {
    fail("buildContext の値が許可されていません");
  }
  return { buildContext: { isPreview: false, mode: "production" } };
}

function validMainModule(value) {
  if (typeof value !== "string" || value === "" || value.includes("\0") || value.includes("\\")) {
    return false;
  }
  if (value.startsWith("/")) return false;
  return value.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

function sanitizeWorkerConfig(obj) {
  assertKeys(
    obj,
    ["name", "compatibilityDate", "compatibilityFlags", "assets", "env", "manifest"],
    "worker.config.json",
  );
  const out = {};
  if ("name" in obj) {
    if (typeof obj.name !== "string") fail("name が文字列ではありません");
    out.name = obj.name;
  }
  if (
    typeof obj.compatibilityDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(obj.compatibilityDate)
  ) {
    fail("compatibilityDate が YYYY-MM-DD ではありません");
  }
  out.compatibilityDate = obj.compatibilityDate;
  if ("compatibilityFlags" in obj) {
    const flags = obj.compatibilityFlags;
    if (!Array.isArray(flags) || !flags.every((f) => f === "nodejs_compat")) {
      fail("compatibilityFlags に許可されていない値があります");
    }
    out.compatibilityFlags = [...flags];
  }
  if ("assets" in obj) {
    if (!isPlainObject(obj.assets)) fail("assets の形式が不正です");
    assertKeys(obj.assets, ["notFoundHandling"], "assets");
    const assets = {};
    if ("notFoundHandling" in obj.assets) {
      if (typeof obj.assets.notFoundHandling !== "string")
        fail("notFoundHandling が文字列ではありません");
      assets.notFoundHandling = obj.assets.notFoundHandling;
    }
    out.assets = assets;
  }
  if ("env" in obj) {
    const env = obj.env;
    if (!isPlainObject(env)) fail("env の形式が不正です");
    assertKeys(env, ["ASSETS"], "env");
    const binding = env.ASSETS;
    if (!isPlainObject(binding) || Object.keys(binding).length !== 1 || binding.type !== "assets") {
      fail("env は ASSETS の assets binding のみ許可されます");
    }
    out.env = { ASSETS: { type: "assets" } };
  }
  const manifest = obj.manifest;
  if (!isPlainObject(manifest)) fail("manifest がありません");
  assertKeys(manifest, ["type", "mainModule", "modules"], "manifest");
  if (manifest.type !== "partial") fail("manifest.type は partial のみ許可されます");
  if (!validMainModule(manifest.mainModule)) fail("manifest.mainModule が不正です");
  if (!isPlainObject(manifest.modules) || Object.keys(manifest.modules).length !== 0) {
    fail("manifest.modules は空である必要があります");
  }
  out.manifest = { type: "partial", mainModule: manifest.mainModule, modules: {} };
  return out;
}

/** 成果物ルート(`.cloudflare/output` を含むディレクトリ)を検査し、検査済みの設定を返す。 */
export async function validateArtifact(dir) {
  const { files, bytes } = await walk(dir);
  const buildConfig = sanitizeBuildConfig(await readJson(path.join(dir, OUTPUT, "v0/config.json")));
  const workerConfig = sanitizeWorkerConfig(
    await readJson(path.join(dir, WORKER, "worker.config.json")),
  );
  const main = await lstat(
    path.join(dir, WORKER, "bundle", workerConfig.manifest.mainModule),
  ).catch(() => null);
  if (!main?.isFile()) fail("mainModule が bundle 内に存在しません");
  return { files, bytes, buildConfig, workerConfig };
}

/** 検査済みの値だけで設定 2 ファイルを作り直し、name を preview 名に置き換える。 */
export async function rewriteWorkerConfig(dir, name) {
  assertPreviewWorkerName(name);
  const { buildConfig, workerConfig } = await validateArtifact(dir);
  const targets = [
    [path.join(dir, OUTPUT, "v0/config.json"), buildConfig],
    [path.join(dir, WORKER, "worker.config.json"), { ...workerConfig, name }],
  ];
  for (const [file, value] of targets) await writeFile(file, JSON.stringify(value));
  for (const [file] of targets) {
    if ((await readFile(file, "utf8")).includes('"dev-tools"')) fail("本番名が設定に残っています");
  }
  const after = await validateArtifact(dir);
  if (after.workerConfig.name !== name) fail("name の書き戻しを確認できませんでした");
  return after;
}

/** テストと CI の dry-run 用の合成の最小成果物を書き出す。 */
export async function writeSyntheticArtifact(dir, overrides = {}) {
  const worker = path.join(dir, WORKER);
  await mkdir(path.join(worker, "bundle"), { recursive: true });
  await mkdir(path.join(worker, "assets"), { recursive: true });
  const buildConfig = overrides.buildConfig ?? {
    buildContext: { isPreview: false, mode: "production" },
  };
  const workerConfig = overrides.workerConfig ?? {
    name: "dev-tools",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: { ASSETS: { type: "assets" } },
    manifest: { type: "partial", mainModule: "index.js", modules: {} },
  };
  await writeFile(path.join(dir, OUTPUT, "v0/config.json"), JSON.stringify(buildConfig));
  await writeFile(path.join(worker, "worker.config.json"), JSON.stringify(workerConfig));
  await writeFile(
    path.join(worker, "bundle/index.js"),
    "export default { fetch() { return new Response('synthetic'); } };\n",
  );
  await writeFile(
    path.join(worker, "assets/index.html"),
    "<!doctype html><title>synthetic</title>\n",
  );
  return { workerDir: worker };
}

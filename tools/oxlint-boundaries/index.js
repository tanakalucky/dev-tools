// 層境界を検査するローカル oxlint JS プラグイン。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UI_PACKAGES = /^(react|react-dom|next|vinext)(\/|$)/;
const BARE = /^(node:[\w/.-]+|@[a-z0-9][\w.-]*\/[\w.-][\w./-]*|[a-z0-9][\w.-]*(\/[\w.@-]+)*)$/i;

/** ルート相対 POSIX パスから層を判定する。対象外は null。 */
export function classify(rel) {
  const seg = rel.split("/");
  if (seg[0] === "app") return { layer: "app" };
  if (seg[0] === "features" && seg.length >= 3) {
    return { layer: "feature", feature: seg[1], sub: seg[2], rel };
  }
  if (["components", "lib", "hooks"].includes(seg[0])) return { layer: "shared" };
  return null;
}

/** 違反理由を返す。問題なければ null。 */
export function check(fromRel, spec) {
  const from = classify(fromRel);
  if (!from) return null;
  if (typeof spec !== "string")
    return "非リテラルの import 先は境界対象ディレクトリで禁止されています";
  const isRel = spec.startsWith("./") || spec.startsWith("../") || spec === "." || spec === "..";
  if (!isRel) {
    if (!BARE.test(spec)) {
      return `未知のエイリアスまたは絶対パス "${spec}" は禁止です(resolver 未対応)`;
    }
    if (from.layer === "feature" && from.sub === "lib" && UI_PACKAGES.test(spec)) {
      return `features/*/lib は React/UI パッケージ "${spec}" に依存できません`;
    }
    return null;
  }
  const targetRel = path.posix.join(path.posix.dirname(fromRel), spec);
  if (targetRel.startsWith("../") || targetRel === "..") {
    return `プロジェクトルート外への import "${spec}" は禁止です`;
  }
  const to = classify(targetRel);
  if (!to) return null;
  if (from.layer === "app") return null;
  if (from.layer === "shared") {
    return to.layer === "shared" ? null : "shared は app / features に依存できません";
  }
  // feature
  if (to.layer === "app") return "features は app に依存できません";
  if (to.layer === "feature" && to.feature !== from.feature) {
    return `features/${from.feature} は別 feature features/${to.feature} に依存できません`;
  }
  if (from.sub === "lib" && to.layer === "feature") {
    if (to.sub === "components" || to.sub === "hooks" || /\.(tsx|jsx)$/.test(targetRel)) {
      return "features/*/lib は同 feature の UI(components/hooks/tsx)に依存できません";
    }
  }
  if (from.sub === "lib" && /\.(tsx|jsx)$/.test(targetRel)) {
    return "features/*/lib は UI(tsx/jsx)に依存できません";
  }
  return null;
}

const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(PLUGIN_DIR, "../..");

/** ルールオプションを検証し、プロジェクトルートの絶対パスを返す。不正なら throw する。 */
export function resolveRoot(options) {
  if (options === undefined || options.length === 0) return DEFAULT_ROOT;
  const opt = options[0];
  if (options.length > 1 || typeof opt !== "object" || opt === null || Array.isArray(opt)) {
    throw new Error("boundaries/import-boundary: オプションは { root?: string } の1つだけです");
  }
  for (const key of Object.keys(opt)) {
    if (key !== "root") throw new Error(`boundaries/import-boundary: 未知のオプション "${key}"`);
  }
  if (opt.root === undefined) return DEFAULT_ROOT;
  if (typeof opt.root !== "string" || opt.root === "") {
    throw new Error("boundaries/import-boundary: root は空でない文字列にしてください");
  }
  const root = path.resolve(PLUGIN_DIR, opt.root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(
      `boundaries/import-boundary: root が存在するディレクトリではありません: ${opt.root}`,
    );
  }
  return root;
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "層境界を検査する" },
    schema: [
      {
        type: "object",
        properties: { root: { type: "string", minLength: 1 } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const root = resolveRoot(context.options);
    const file = path.resolve(context.physicalFilename ?? context.filename);
    const rootRel = path.relative(root, file).split(path.sep).join("/");
    if (classify(rootRel) === null) return {};
    const report = (node, msg) => msg && context.report({ node, message: msg });
    const lit = (n) => (n && n.type === "Literal" && typeof n.value === "string" ? n.value : null);
    const src = (node, s) => {
      if (s) report(node, check(rootRel, s.value));
    };
    return {
      ImportDeclaration: (n) => src(n, n.source),
      ExportNamedDeclaration: (n) => n.source && src(n, n.source),
      ExportAllDeclaration: (n) => src(n, n.source),
      ImportExpression(n) {
        const v = lit(n.source);
        report(n, check(rootRel, v));
      },
      TSImportType(n) {
        const s = n.source ?? n.argument?.literal ?? n.argument;
        const v = lit(s) ?? lit(s?.literal);
        report(n, check(rootRel, v));
      },
      TSImportEqualsDeclaration(n) {
        report(n, "import = require() は境界対象ディレクトリで禁止されています");
      },
      CallExpression(n) {
        const c = n.callee;
        if (c.type === "Identifier" && (c.name === "require" || c.name === "importScripts")) {
          report(n, `${c.name}() は境界対象ディレクトリで禁止されています`);
        } else if (
          c.type === "MemberExpression" &&
          c.object.type === "MetaProperty" &&
          c.property.name?.startsWith("glob")
        ) {
          report(n, "import.meta.glob は境界対象ディレクトリで禁止されています");
        }
      },
    };
  },
};

export default { meta: { name: "boundaries" }, rules: { "import-boundary": rule } };

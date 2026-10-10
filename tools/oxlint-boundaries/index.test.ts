import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../..");
const fixtures = path.join(here, "fixtures");
// fixtures 専用 config。fixtures 内に置くと通常の oxlint が自動検出して lint してしまうため外に置く。
const fixturesConfig = path.join(here, "fixtures.oxlintrc.json");
const bin = path.join(projectRoot, "node_modules/oxlint/bin/oxlint");

// oxlint 1.87.0 の実出力で確認したルール ID の表記。
const RULE_CODE = "boundaries(import-boundary)";

type Diagnostic = {
  message: string;
  code: string;
  severity: string;
  filename: string;
  labels: { span: { line: number; column: number } }[];
};

type Run = { status: number | null; stdout: string; stderr: string; diagnostics: Diagnostic[] };

/** 実 oxlint を実行し、spawn 失敗・シグナル終了・JSON 不正を即座にテスト失敗にする。 */
function runOxlint(cwd: string, args: string[]): Run {
  const r = spawnSync(process.execPath, [bin, "-f", "json", ...args], { cwd, encoding: "utf8" });
  expect(r.error).toBeUndefined();
  expect(r.signal).toBeNull();
  let diagnostics: Diagnostic[] = [];
  if (r.status === 0 || r.status === 1) {
    diagnostics = (JSON.parse(r.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
  }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, diagnostics };
}

// 違反理由(メッセージ)。
const M = {
  appFromFeature: "features は app に依存できません",
  otherFeature: "features/json は別 feature features/csv に依存できません",
  importEquals: "import = require() は境界対象ディレクトリで禁止されています",
  nonLiteral: "非リテラルの import 先は境界対象ディレクトリで禁止されています",
  require: "require() は境界対象ディレクトリで禁止されています",
  glob: "import.meta.glob は境界対象ディレクトリで禁止されています",
  sharedToUpper: "shared は app / features に依存できません",
  libUi: "features/*/lib は同 feature の UI(components/hooks/tsx)に依存できません",
  alias: (s: string) => `未知のエイリアスまたは絶対パス "${s}" は禁止です(resolver 未対応)`,
  outsideRoot: (s: string) => `プロジェクトルート外への import "${s}" は禁止です`,
  uiPkg: (s: string) => `features/*/lib は React/UI パッケージ "${s}" に依存できません`,
};

type Expected = [line: number, column: number, message: string];

const invalid: Record<string, Expected[]> = {
  "app/invalid-alias.ts": [
    [1, 1, M.alias("~/x")],
    [2, 1, M.alias("#x")],
    [3, 1, M.alias("/abs/x")],
    [4, 1, M.outsideRoot("@/../outside")],
    [5, 1, M.alias("@//x")],
    [6, 1, M.alias("@")],
  ],
  "app/invalid-dynamic.ts": [
    [3, 18, M.nonLiteral],
    [4, 18, M.require],
    [5, 18, M.glob],
  ],
  "lib/invalid-shared.ts": [
    [1, 1, M.sharedToUpper],
    [2, 1, M.sharedToUpper],
    [3, 1, M.sharedToUpper],
    [4, 1, M.sharedToUpper],
    [5, 1, M.sharedToUpper],
    [6, 1, M.sharedToUpper],
    [7, 18, M.sharedToUpper],
    [8, 17, M.sharedToUpper],
    [9, 1, M.sharedToUpper],
    [10, 1, M.sharedToUpper],
  ],
  "features/json/components/invalid-feature.ts": [
    [1, 1, M.appFromFeature],
    [2, 1, M.otherFeature],
    [3, 1, M.otherFeature],
    [4, 1, M.otherFeature],
    [5, 1, M.otherFeature],
    [6, 1, M.otherFeature],
    [7, 1, M.otherFeature],
    [8, 18, M.otherFeature],
    [9, 17, M.otherFeature],
    [10, 1, M.importEquals],
    [11, 1, M.appFromFeature],
    [12, 1, M.otherFeature],
  ],
  "features/json/lib/invalid-ui.ts": [
    [1, 1, M.uiPkg("react")],
    [2, 1, M.uiPkg("react-dom/client")],
    [3, 1, M.uiPkg("next/link")],
    [4, 1, M.libUi],
    [5, 1, M.libUi],
    [6, 1, "features/*/lib は同 feature の UI(components/hooks/tsx)に依存できません"],
    [7, 1, M.otherFeature],
    [8, 1, M.appFromFeature],
    [9, 1, M.libUi],
  ],
};

const valid = [
  "app/valid.ts",
  "features/json/components/valid.tsx",
  "features/json/lib/valid.ts",
  "lib/valid.ts",
];

const actual = (run: Run, file: string): Expected[] =>
  run.diagnostics
    .filter((d) => d.filename === file)
    .map((d) => [d.labels[0].span.line, d.labels[0].span.column, d.message]);

describe("oxlint-boundaries(実エンジン)", () => {
  const fixtureRun = runOxlint(fixtures, ["-c", fixturesConfig, "."]);

  it("違反ありの実行は終了コード 1 で、全診断が境界ルールの ID を持つ", () => {
    expect(fixtureRun.status).toBe(1);
    expect(fixtureRun.stderr).toBe("");
    expect(fixtureRun.diagnostics.length).toBeGreaterThan(0);
    for (const d of fixtureRun.diagnostics) {
      expect(d.code).toBe(RULE_CODE);
      expect(d.severity).toBe("error");
    }
  });

  it("診断はすべて既知の invalid fixture に属する(parse エラーや余計なファイルがない)", () => {
    const files = new Set(fixtureRun.diagnostics.map((d) => d.filename));
    expect([...files].sort()).toEqual(Object.keys(invalid).sort());
  });

  for (const [file, expected] of Object.entries(invalid)) {
    it(`${file}: 期待する ${expected.length} 件の違反(行・列・理由)と完全一致する`, () => {
      expect(actual(fixtureRun, file)).toEqual(expected);
    });
  }

  for (const file of valid) {
    it(`${file}: 診断 0 件(許可される import のみ)`, () => {
      expect(actual(fixtureRun, file)).toEqual([]);
    });
  }

  it("feature→app と feature→別 feature は理由で区別される", () => {
    const rows = actual(fixtureRun, "features/json/components/invalid-feature.ts");
    expect(rows.filter((r) => r[2] === M.appFromFeature).map((r) => r[0])).toEqual([1, 11]);
    expect(rows.filter((r) => r[2] === M.otherFeature)).toHaveLength(9);
  });
});

describe("プロジェクトルートの決定(cwd 非依存)", () => {
  const rootConfig = path.join(projectRoot, ".oxlintrc.json");
  const realFiles = [
    path.join(projectRoot, "features/json/lib/index.ts"),
    path.join(projectRoot, "app/json/page.tsx"),
  ];
  const otherCwds = [here, os.tmpdir()];

  for (const cwd of otherCwds) {
    it(`cwd=${cwd}: ルート config で実ファイルは違反 0・正常終了`, () => {
      const run = runOxlint(cwd, ["-c", rootConfig, ...realFiles]);
      expect(run.stderr).toBe("");
      expect(run.status).toBe(0);
      expect(run.diagnostics).toEqual([]);
    });

    it(`cwd=${cwd}: fixtures の invalid を lint すると期待違反が出る(ルールが有効)`, () => {
      const file = "features/json/components/invalid-feature.ts";
      const run = runOxlint(cwd, ["-c", fixturesConfig, path.join(fixtures, file)]);
      expect(run.status).toBe(1);
      expect(run.diagnostics).toHaveLength(invalid[file].length);
      for (const d of run.diagnostics) expect(d.code).toBe(RULE_CODE);
      expect(run.diagnostics.map((d) => d.message)).toEqual(invalid[file].map((e) => e[2]));
    });
  }
});

describe("ルールオプションの検証", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "boundaries-opt-"));
  const target = path.join(fixtures, "app/valid.ts");
  const lintWith = (option: unknown) => {
    const config = path.join(tmp, `${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(
      config,
      JSON.stringify({
        jsPlugins: [path.join(here, "index.js")],
        rules: { "boundaries/import-boundary": ["error", option] },
      }),
    );
    const r = spawnSync(process.execPath, [bin, "-c", config, "-f", "json", target], {
      cwd: tmp,
      encoding: "utf8",
    });
    expect(r.error).toBeUndefined();
    expect(r.signal).toBeNull();
    return r;
  };

  it.each([
    ["未知のキー", { foo: 1 }],
    ["root が文字列でない", { root: 1 }],
    ["root が空文字列", { root: "" }],
    ["オブジェクトでない", "fixtures"],
  ])("%s はエラーで終了する", (_name, option) => {
    const r = lintWith(option);
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toMatch(/option|import-boundary|schema|root/i);
  });

  it("存在しない root はエラーで終了し、黙って無効化されない", () => {
    const r = lintWith({ root: "no-such-dir-xyz" });
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("root");
  });
});

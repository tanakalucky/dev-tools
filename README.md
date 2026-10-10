# dev-tools

Browser-only developer utilities. Tool input is processed locally in the browser: it is not sent over the network, not persisted, and not tracked.

## Status

Work in progress. **Not deployed and not approved.** ブラウザ E2E は CI の実 Chromium で確認済み(下記の commit のみ。ローカルのブラウザ起動はこの環境ではブロックされている)。

- Implemented: a JSON formatter at `/` and `/json` (format with 2 spaces, minify, validate, duplicate-key warnings, copy, clear). See [docs/tools/json/spec.md](docs/tools/json/spec.md).
- 最新の CI 証拠(歴史的): 公開コミット f07c94044294c21bf628d7810d49292b5a1e3b48 で unit 156 と実 Chromium E2E 17 が CI で成功した。この証拠はそのコミットのみに対するもの。
- 現在の作業ツリー(ディレクトリ構成移行と境界 lint の変更)はローカル検証のみ: unit 177 件、typecheck / lint / fmt:check / build は成功。E2E は 17 件の列挙のみで本体は未実行。実 CI は未確認で、CI で観測されるまで証拠として数えない。
- ローカルのブラウザ起動はこの環境ではブロックされている(`@cloudflare/vite-plugin` 内の `os.networkInterfaces` エラー)。未解決の optional peer(`react-server-dom-webpack/static.edge`)の警告は別件で、`@vitejs/plugin-rsc` が自前のコピーを同梱するためパッケージは意図的に追加していない。
- CI: `.github/workflows/ci.yml`(unit、typecheck、lint、format check、build、Node 24 での Playwright E2E、read-only 権限、secrets なし)。
- Review: 1 of 3 rounds consumed (external, historical_unverified, no approval); round 2 is pending and not started.
- Encoded JSON (conservative): pasting a JSON string literal whose content is an object or array, e.g. `"{\"a\":1}"`, is decoded by exactly one layer and formatted; large numbers, key order, duplicate keys and inner escapes are preserved. Line and column numbers then refer to the decoded text, and a checkbox (on by default) turns decoding off. Limits (1 MiB input, depth, output) apply to the original and decoded text. Unsupported: raw shell quoting, prompts or prefixes, arbitrary backslash removal, double-encoded or deeper layers, encoded scalars, unknown terminal formats. Ordinary JSON strings remain strings. No exact terminal sample was provided, so not all terminal pastes are handled.- Not done, not authorized in this phase: deployment and preview. The stack is [vinext](https://vinext.dev) targeting Cloudflare Workers; nothing is live.

## Setup

Declares Node.js 22.12 or newer (declared, not tested as a version matrix).

```sh
npm install
npm run dev
```

Then open the local URL printed by the dev server. The home page lists the tools; the JSON formatter is at `/json`.

## Scripts

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the local dev server                   |
| `npm run build`     | Production build                             |
| `npm test`          | Run the unit tests (vitest)                  |
| `npm run test:e2e`  | Run the browser tests (Playwright, Chromium) |
| `npm run typecheck` | Type-check with `tsc --noEmit`               |
| `npm run lint`      | Lint with oxlint                             |
| `npm run fmt:check` | Check formatting with oxfmt                  |
| `npm run format`    | Apply formatting with oxfmt                  |

`npm run test:e2e` starts `npm run dev` on `127.0.0.1:43173` and runs `e2e/*.pw.ts` in Chromium only. It needs a Playwright Chromium build, installed once with `npx playwright install chromium`. What the browser tests cover and what is still pending is listed in the [JSON spec](docs/tools/json/spec.md#browser-tests).

There is no deploy command yet.

## Layout

- `app/` - ルート・レイアウト・薄い composition のみ(ホームと `/json`)。
- `features/` - 機能単位のコード。現在は `features/json/`(UI は `components/`、純粋処理は `lib/`)。詳細は [features/README.md](features/README.md)。
- `tools/oxlint-boundaries/` - 層境界を検査するローカル oxlint JS プラグイン(alpha・semver 保証なし)。詳細は [tools/oxlint-boundaries/README.md](tools/oxlint-boundaries/README.md)。設定は `.oxlintrc.json`。
- ルート直下の `components/` `lib/` `hooks/` は、複数機能で本当に共有するものが出た時だけ作る(現在は無し)。

### 依存ルール(このルート README が所有)

- `app` は `features` と共有コードを import してよい。
- feature は `app` と別の feature を import しない。
- 共有コードは `app` と `features` を import しない。
- `features/*/lib` は React や UI を import しない。
- テストは対象ファイルの隣に置く。
- 上記の import 依存ルールはローカル oxlint プラグイン(`npm run lint`)で検査する。実装済みだが CI では未実行(上記 Status 参照)。テストの隣置きはレビューで確認する。

- `e2e/` - Playwright browser tests (`*.pw.ts`), configured in `playwright.config.ts`.
- `docs/tools/<tool>/` - per-tool specs. Currently: [JSON](docs/tools/json/spec.md).

## Documentation

- JSON tool spec: [docs/tools/json/spec.md](docs/tools/json/spec.md)
- Contributor and agent workflow: [CLAUDE.md](CLAUDE.md)

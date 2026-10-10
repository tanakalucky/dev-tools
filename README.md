# dev-tools

Browser-only developer utilities. Tool input is processed locally in the browser: it is not sent over the network, not persisted, and not tracked.

## Status

Work in progress. **Not deployed and not approved.** ローカルのブラウザ起動はこの環境ではブロックされている。

- Implemented: a JSON formatter at `/` and `/json` (format with 2 spaces, minify, validate, duplicate-key warnings, copy, clear). See [docs/tools/json/spec.md](docs/tools/json/spec.md).
- CI: head 51aace6 で unit 177 件と Chromium E2E 17 件が成功した。この変更(shadcn/ui 導入)後の結果は未確定。
- ローカルのブラウザ起動はこの環境ではブロックされている(`@cloudflare/vite-plugin` 内の `os.networkInterfaces` エラー)。未解決の optional peer(`react-server-dom-webpack/static.edge`)の警告は別件で、`@vitejs/plugin-rsc` が自前のコピーを同梱するためパッケージは意図的に追加していない。
- CI: `.github/workflows/ci.yml`(unit、typecheck、lint、format check、build、Node 24 での Playwright E2E、read-only 権限、secrets なし)。
- Review: 2 of 3 rounds consumed; the final round has not been run. Not approved.
- Encoded JSON (conservative): pasting a JSON string literal whose content is an object or array, e.g. `"{\"a\":1}"`, is decoded by exactly one layer and formatted; large numbers, key order, duplicate keys and inner escapes are preserved. Line and column numbers then refer to the decoded text, and a checkbox (on by default) turns decoding off. Limits (1 MiB input, depth, output) apply to the original and decoded text. Unsupported: raw shell quoting, prompts or prefixes, arbitrary backslash removal, double-encoded or deeper layers, encoded scalars, unknown terminal formats. Ordinary JSON strings remain strings. No exact terminal sample was provided, so not all terminal pastes are handled.
- Preview runs on GitHub Actions ([docs/deploy/README.md](docs/deploy/README.md)). There is no production deploy. The stack is [vinext](https://vinext.dev) targeting Cloudflare Workers.

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
- `components/ui/` - shadcn/ui の公式部品(Base UI 版)。追加は公式 CLI と `components.json` で行い、部品のソースは手で改変しない。
- `lib/utils.ts` - `cn` の再エクスポート(部品が使う)。
- 共有コードの import は `@/` エイリアス(プロジェクトルート相対)を使う。ルート直下の `hooks/` は、複数機能で本当に共有するものが出た時だけ作る(現在は無し)。

### 依存ルール(責務と設計意図)

- 依存の向きは一方向。`app` は `features` と共有コード(ルートの `components/` `lib/` `hooks/`)の両方を直接使ってよく、`features` も共有コードを使ってよい。逆向きと feature 同士の依存は避け、feature は互いに独立させる。
- `features/*/lib` は React / DOM / network に依存しない純粋処理を置く場所。
- テストは対象ファイルの隣に置く(レビューで確認する)。
- import の依存禁止は機械検査される。機械実行の正本は [index.js](tools/oxlint-boundaries/index.js)、`.oxlintrc.json`、`tools/oxlint-boundaries/fixtures/` とテスト(`index.test.ts`)で、`npm run lint` で実行する。[tools/oxlint-boundaries/README.md](tools/oxlint-boundaries/README.md) は検証済みの範囲と限界の説明であり、正本そのものではない。DOM/network 非依存など lint が見ない純粋性は検査されない。

- `e2e/` - Playwright browser tests (`*.pw.ts`), configured in `playwright.config.ts`.
- `docs/tools/<tool>/` - per-tool specs. Currently: [JSON](docs/tools/json/spec.md).

## Documentation

- JSON tool spec: [docs/tools/json/spec.md](docs/tools/json/spec.md)
- Contributor and agent workflow: [CLAUDE.md](CLAUDE.md)

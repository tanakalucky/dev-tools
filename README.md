# dev-tools

Browser-only developer utilities. Tool input is processed locally in the browser: it is not sent over the network, not persisted, and not tracked.

## Status

Four tools are implemented: the JSON formatter at `/json` ([features/json-formatter/README.md](features/json-formatter/README.md)), the character count at `/character-count` ([features/character-count/README.md](features/character-count/README.md)), the character generator at `/character-generator` ([features/character-generator/README.md](features/character-generator/README.md)), and the width converter at `/width-converter` ([features/width-converter/README.md](features/width-converter/README.md)). The home page `/` links to all of them.

- Preview deploys run for pull requests, and production deploys from verified main pushes on GitHub Actions ([docs/deploy/README.md](docs/deploy/README.md)).
- The stack is [vinext](https://vinext.dev) targeting Cloudflare Workers.
- CI: `.github/workflows/ci.yml` (unit, typecheck, lint, format check, build, Node 24 Playwright E2E, read-only permissions, no secrets).

## Setup

Declares Node.js 22.18 or newer (declared, not tested as a version matrix).

```sh
npm install
npm run dev
```

Then open the local URL printed by the dev server.

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

`npm run test:e2e` starts `npm run dev` on `127.0.0.1:43173` and runs `e2e/*.pw.ts` in Chromium only. It needs a Playwright Chromium build, installed once with `npx playwright install chromium`.

There is no deploy command yet.

## Layout

- `app/` - ルート・レイアウト・薄い composition のみ。`app/tools.ts` はサイドバーに出すツール一覧(現在は JSON Formatter・Character Count・Character Generator・Width Converter)。
- `features/` - 機能単位のコード。詳細は [features/README.md](features/README.md)。現在は [json-formatter](features/json-formatter/README.md)・[character-count](features/character-count/README.md)・[character-generator](features/character-generator/README.md)・[width-converter](features/width-converter/README.md)。
- `tools/oxlint-boundaries/` - 層境界を検査するローカル oxlint JS プラグイン(alpha・semver 保証なし)。詳細は [tools/oxlint-boundaries/README.md](tools/oxlint-boundaries/README.md)。設定は `.oxlintrc.json`。
- `components/ui/` - shadcn/ui の公式部品(Base UI 版)を配置する場所。追加は公式 CLI と `components.json` で行い、部品のソースは手で改変しない。現在は `button` を JSON Formatter・Character Generator・Width Converter が、`textarea` を JSON Formatter・Character Count・Character Generator・Width Converter が使う。見た目の調整は呼び出し側の `className` と `app/globals.css` のトークンで行う(配色はラベンダー系)。
- `components/app-shell.tsx` - ヘッダーと左ナビゲーションを持つ共通の枠。狭い画面ではナビゲーションがヘッダー下の横並びになる。
- `lib/utils.ts` - `cn` の再エクスポート(共通枠が使う)。shadcn の公式部品は `cn` パッケージを直接 import する。
- 共有コードの import は `@/` エイリアス(プロジェクトルート相対)を使う。ルート直下の `hooks/` は、複数機能で本当に共有するものが出た時だけ作る(現在は無し)。

### 依存ルール(責務と設計意図)

- 依存の向きは一方向。`app` は `features` と共有コード(ルートの `components/` `lib/` `hooks/`)の両方を直接使ってよく、`features` も共有コードを使ってよい。逆向きと feature 同士の依存は避け、feature は互いに独立させる。
- `features/*/lib` は React / DOM / network に依存しない純粋処理を置く場所。
- テストは対象ファイルの隣に置く(レビューで確認する)。
- import の依存禁止は機械検査される。機械実行の正本は [index.js](tools/oxlint-boundaries/index.js)、`.oxlintrc.json`、`tools/oxlint-boundaries/fixtures/` とテスト(`index.test.ts`)で、`npm run lint` で実行する。[tools/oxlint-boundaries/README.md](tools/oxlint-boundaries/README.md) は検証済みの範囲と限界の説明であり、正本そのものではない。DOM/network 非依存など lint が見ない純粋性は検査されない。

- `e2e/` - Playwright browser tests (`*.pw.ts`), configured in `playwright.config.ts`.

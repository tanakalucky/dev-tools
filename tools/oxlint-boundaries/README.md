# oxlint-boundaries

層の依存方向を検査するローカル oxlint JS プラグイン。規則本体はルート [README.md](../../README.md) の「依存ルール」が所有し、ここでは複製しない。

- 有効化: ルート `.oxlintrc.json` の `jsPlugins`(ルール `boundaries/import-boundary` は error)。
- 検査対象: `app/`、`features/*/`、ルート直下の `components/` `lib/` `hooks/` のファイル。
- 対応構文: static / side-effect / type import、named / star / type re-export、literal の `import()`、TS の `import("...")` 型、`../` の正規化。
- 明示的にエラー: `require()`、`import x = require()`、`import.meta.glob*`、非 literal の動的 import、未知のエイリアス(`@/` `~/` `#` や絶対パス)。
- プロジェクトルート: 既定はプラグイン自身の位置の2階層上(`tools/oxlint-boundaries` → リポジトリルート)で、実行時の cwd には依存しない。fixtures 用にだけルールオプション `{ "root": "<パス>" }` で変更でき、相対パスはプラグインのディレクトリ基準で解決する(例: `fixtures.oxlintrc.json` は `"root": "fixtures"`。この config は通常の lint に自動検出されないよう fixtures の外に置く)。不正な型・未知キー・存在しない root は黙って無効化せずエラーになる。
- テスト: `index.test.ts` が `fixtures/` を実際の oxlint で実行する(`npm run test`)。fixtures は通常の lint から ignore 済み。

## 注意

- oxlint の JS plugin は alpha で semver 保証がない。oxlint は固定バージョンで使い、更新時は本テストで確認する。
- alias を追加する場合は、このプラグインの resolver を build 設定と一致させる必要がある。
- 全てを検知するセキュリティ保証ではない(例: 設定による alias、`eval` 等は対象外)。

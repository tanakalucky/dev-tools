# features/json

JSON 整形・圧縮・検証ツール(`/json`)の機能一式。feature 間・app との依存ルールは
[features/README.md](../README.md) とルート [README.md](../../README.md) を参照する。

- `components/` - JSON ツールの UI(クライアントコンポーネント `json-tool.tsx`)。
- `lib/` - React・DOM・ネットワークに依存しない純粋な JSON 処理。公開入口は `lib/index.ts`。
  入力サイズ上限 `size-limit.ts` もここに置く。React/UI への import は
  [oxlint-boundaries](../../tools/oxlint-boundaries/README.md) が検査する。
- `hooks/` - 現状は未作成。意味のある state 分離が必要になった時だけ追加する。

テストは対象ファイルの隣、E2E は `e2e/`、仕様は `docs/tools/json/spec.md`。

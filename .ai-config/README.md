# dev-tools 共通config

固定元は [tanakalucky/ai-dev-config](https://github.com/tanakalucky/ai-dev-config/tree/8b9dabdc34eb493be5bd061d0c439590552c4099)、commit `8b9dabdc34eb493be5bd061d0c439590552c4099`。

## 配置

- `AGENTS.md` は共通指示にdev-tools固有ルールを追記した正本。既存READMEの責務・依存・検証・UI部品ルールを保持する。
- `CLAUDE.md` は同じルートの `AGENTS.md` への相対symlink。
- `.ai-config/` が共通本文、`.agents/`・`.claude/` が入口と役割定義、`.codex/agents/` がCodexのproject-scoped役割定義。`.codex/`全体は配布しない。
- Codexのモデル・読取専用条件は [.agents/review-runtime.md](../.agents/review-runtime.md) に従う。文書だけで権限が強制されるとは扱わない。
- 共通のFSD規約は今後の配置検討に使い、既存の `app/`・`features/`・共有コードや依存検査を一括移行しない。
- `.ai-config/examples/preview-e2e/` は導入例であり、コピーだけで有効にならない。既存workflow・デプロイ・E2Eは維持する。
- `tests/test_project_integration.py` はアプリ固有の指示、リンク、入口と配布範囲を検証する。上流で撤去されたPythonテストとは別に維持する。

上流の `.git/`・ルートREADME・`docs/validation/`、会話ログ・認証情報・秘密・実行用キャッシュはコピーしない。
更新時は固定commitとの差分を確認し、プロジェクト固有の追記や他のskillを上書きしない。

## 検証

```sh
readlink CLAUDE.md
python3 -B -m unittest discover -s .ai-config/tests -v
npm run test:ai-config
```

期待するリンク先は `AGENTS.md`。標準ライブラリで参照がアプリ内に解決することを確認する。
静的な配置確認は、CLIでの実探索・委譲・sandbox強制や実Preview E2Eの検証とは区別する。

npm testは既存のVitestテストの後にNodeのサンプルテストを実行する。`.ai-config/examples/**` だけをVitestの収集対象から除く。
共通本文は既存Oxfmtの規則に合わせて整形するため、固定上流とは書式のみ異なるファイルがある。
CIはPRの実head（pushでは対象commit）をcheckoutして検証する。

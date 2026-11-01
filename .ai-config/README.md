# dev-tools 共通config

固定元は [tanakalucky/claude-config](https://github.com/tanakalucky/claude-config/tree/1ebac1b35b51cda5e0de69445f99ceca89d01d83)、commit `1ebac1b35b51cda5e0de69445f99ceca89d01d83`。
適用時に最新mainと一致することを確認した。

## 配置

- `AGENTS.md` は共通指示にdev-tools固有ルールを追記した正本。既存READMEの責務・依存・検証・UI部品ルールを保持する。
- `CLAUDE.md` は同じルートの `AGENTS.md` への相対symlink。
- `.ai-config/rules/`・`workflows/`・`review/` が共通本文。AAAと、初回を含め最大3ラウンド・P0/P1ゼロで早期終了するレビュー方針を含む。
- `.agents/` と `.claude/skills/` は各ツールの参照入口。Codexのモデル・読取専用条件は `.agents/review-runtime.md` に従う。Markdownだけで権限が強制されるとは扱わない。
- `.ai-config/tests/test_layout.py` は上流のコピー参照テスト、`test_project_integration.py` はアプリ固有のリンクと配布範囲を検証する。

上流の `.git/`・README・`.ai-config/validation/`、会話ログ・認証情報・秘密・実行用キャッシュはコピーしない。
生成スクリプトや再生成は不要。更新時は固定commitとの差分を確認し、プロジェクト固有の追記や他のskillを上書きしない。

## 検証

```sh
readlink CLAUDE.md
python3 -B -m unittest discover -s .ai-config/tests -v
```

期待するリンク先は `AGENTS.md`。標準ライブラリのみで配布物を一時ディレクトリへコピーし、リンクが配置先の内側で解決することを確認する。
CLIでの実探索・委譲・sandbox強制は静的テストと区別し、実行条件を確認できないレビューは未完了として報告する。

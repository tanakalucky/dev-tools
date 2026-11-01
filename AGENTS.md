# 共通の作業指示

Codexのレビュー担当（親・子）は、規約・skillを読む最初の操作からshellをGit読取に限定する。
初期読込も例外にせず、次の順序で読む。パスはこのファイルと同じルートを基準にする。

1. `git ls-files --cached --others --exclude-standard -- <読む文書の明示パス>...` で対象名を確認し、機密・ignoredを除く。
2. 確認できた文書の現在本文を専用の読取ツールで読む。専用ツールがなければ、各文書を `git diff --no-index -- /dev/null <path>` で全文取得する（差分ありの終了コード1は正常）。まず下記コーディング規約と[Codexの実行条件](.agents/review-runtime.md)、続いて指定skillとその参照先を読む。

初期読込に`cat`・`rg`・`pwd`を使わず、`git show HEAD:<path>`で現在本文を置き換えない。
必要な文書や読取手段が不足する場合は迂回せず、未完了と報告する。
これはプロンプトによる運用指示であり、コマンド名の技術的な拒否を保証しない。
書込拒否は実行側のread-only sandboxで別途強制し、既存の権限条件を緩めない。

作業開始時に、このファイルと同じルートにある
[コーディング規約](.ai-config/rules/coding.md)を全文読んで適用する。
Markdownリンクの自動展開を前提にせず、明示的に読む。見つからなければ不足を報告する。

実装前の認識合わせにはClaude Codeの`/clarify`、Codexの`$config-clarify`を使う。
レビューを依頼された場合はClaude Codeの`/review`、Codexの`$config-review`を使う。
いずれも各ツールの入口から`.ai-config/`の共通手順を読む。

レビューと修正は[ラウンドの共通定義](.ai-config/review/rounds.md)を読んで進める。
各ラウンドでは正確性/安全性・テスト・設計/可読性を独立した担当に各1回依頼して統合する。
レビュー担当は報告のみ、修正とラウンド管理は実装担当が行う。
利用できない入口・委譲機能や未完了の観点は未完了と報告する。
実装担当が自分で読み直すことを独立レビューに数えない。

## dev-tools 固有の指示

共通指示に加え、[README](README.md) と対象featureのREADMEを読んで適用する。
共通設定の固定元・コピー範囲・検証方法は [.ai-config/README.md](.ai-config/README.md) に記録する。

- ブラウザ内で処理する開発者向けツール。入力をサーバーへ送信・追跡しない。電卓の履歴はlocalStorageに最大50件保存し、他ツールの入力は永続化しない。
- `app/` はルート・レイアウト・薄いcomposition、`features/` は独立した機能。共有コードのimportは `@/` を使い、feature同士や共有コードからfeatureへの依存を作らない。
- `features/*/lib` はReact・DOM・networkに依存しない純粋処理を置き、テストは対象ファイルの隣に置く。
- 依存境界の機械実行の正本は `tools/oxlint-boundaries/index.js` とfixtures・テスト・`.oxlintrc.json`。[検証範囲と限界](tools/oxlint-boundaries/README.md)を読み、lintが確認しない純粋性もレビューする。
- `components/ui/` のshadcn公式部品は公式CLIと `components.json` で追加し、部品ソースを手で改変しない。見た目は呼出側のclassNameと `app/globals.css` のトークンで調整する。
- Node.jsは22.18以上。既存検証コマンドは `npm test`、`npm run typecheck`、`npm run lint`、`npm run fmt:check`、`npm run build`、`npm run test:e2e`。変更に応じて実行し、未実行を成功としない。
- 共通configのコピー検証は `python3 -B -m unittest discover -s .ai-config/tests -v`。検証用履歴・秘密・依存ディレクトリを配布設定へコピーしない。
- デプロイ手順は [docs/deploy/README.md](docs/deploy/README.md)。push・PR・merge・本番更新や外部設定変更は、その作業についてユーザーが承認した範囲で行う。

# features

機能(ツール)単位のコードを置く。1 ディレクトリが 1 機能。

- feature は互いに独立させる。共有が必要なら、ルートの共有コードへ移す。
- 依存の向きは [ルート README の依存ルール](../README.md) に従う。import の機械検査の範囲と限界は [tools/oxlint-boundaries/README.md](../tools/oxlint-boundaries/README.md) を参照(機械実行の正本はそのプラグインの `index.js`・fixtures・テスト)。
- 各 feature の構成は、その feature の README に任せる。

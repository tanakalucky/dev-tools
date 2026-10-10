# features

機能(ツール)単位のコードを置く。1 ディレクトリが 1 機能で、直下の子は現在 `json/` のみ。

- feature 同士は互いに import しない。共有が必要なら、ルートの共有コードへ移す。
- `app` や共有コードへの依存の向きは [ルート README の依存ルール](../README.md) に従う。
- 各 feature の構成は、その feature の README に任せる(例: [json](json/README.md))。

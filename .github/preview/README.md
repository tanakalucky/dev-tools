# preview helper

preview deploy workflow から呼ばれる、Node 標準機能だけの helper(依存は `cf` のみ)。

## 責務

- `lib/names.mjs`: Worker 名 `dev-tools-pr-<n>` の生成と検査。
- `lib/decide.mjs`: deploy / delete / skip の判定(純粋関数)。
- `lib/artifact.mjs`: ビルド成果物の許可リスト検査と、設定の書き戻し。
- `lib/github.mjs`: GitHub REST API の読み取りと step output の書き出し。
- `bin/preview.mjs`: 上記を workflow から呼ぶ薄い CLI。

## 置くもの・置かないもの

- 置く: preview の判定・検査・名前に関するコードとそのテスト。
- 置かない: アプリのコード、secret、本番 deploy の処理、Cloudflare への直接の呼び出し(`cf` の実行は workflow 側)。

## テスト

`.github/preview` で `npm ci --ignore-scripts` のあと `node --test "lib/*.test.mjs"` を実行する。全体の流れと信頼境界は `docs/deploy/README.md` を参照。

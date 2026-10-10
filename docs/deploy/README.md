# preview deploy

PR のブランチごとに Cloudflare の Worker Preview(Worker `dev-tools`)を作り、push で更新し、PR が閉じられたら削除する仕組み。
すべて GitHub Actions で行い、Workers Builds は使わない。本番 deploy と custom domain は対象外。
deploy 経路は実 CI でも Cloudflare でも未実行で、削除は模擬 API での確認だけ。

## 流れ

1. 作成・更新: `preview-deploy`(`pull_request`: opened / synchronize / reopened、job は 1 つ)。
   PR の head を checkout → `npm ci` → `CLOUDFLARE_PREVIEW_BUILD=true npm run build` →
   `cf previews deploy <ブランチ名> --prebuilt`(アプリが固定している `cf` を使う)。
   ルートに `package.json` が無い PR(基盤 PR 自身など)では何もしない。
2. 削除: `preview-cleanup`(`pull_request_target`: closed、または手動実行)。`wrangler preview delete` で Preview を消す。

## 信頼モデル

- 対象は本人が管理する PR だけ。build と deploy は同じ job で動くため、PR の build コードは deploy step の secret に
  影響しうる。これを受け入れており、secret の隔離は主張しない。
- fork の PR と、owner 以外が起動・再実行した run では job が動かない(`github.actor`・`github.triggering_actor`・
  `github.actor_id` がリポジトリ owner と一致するときだけ)。PR 作者名や commit author は見ない。
- `pull_request` の workflow は PR 側の定義で動くため、これらの条件は PR 側で書き換えられる。本人管理の PR に限る前提で受け入れている。

## 2 つの workflow の信頼境界

| 項目           | preview-deploy                                              | preview-cleanup                                                                 |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 起動           | `pull_request`(opened / synchronize / reopened)            | `pull_request_target`(closed)、`workflow_dispatch`(既定ブランチからだけ)        |
| 実行するコード | PR の head(build を含む)                                    | 既定ブランチの `.github/preview` で版を固定した `wrangler`。PR のコードは実行しない |
| 権限           | `contents: read`、`pull-requests: read`                     | 同左                                                                            |
| secret         | deploy step の `env` だけ                                   | 削除 step の `env` だけ                                                         |
| 対象           | 同一リポジトリの PR、owner 本人の起動・再実行だけ           | head が同じリポジトリの PR だけ。同じブランチの open な PR が残っていれば削除しない |

## 名前の規則

Preview 名は PR の head ブランチ名そのもの(`pr-<n>` は使わない)。

- ブランチ名は `env` 経由で渡し、`run:` に直接埋め込まない。
- `.github/preview/check-preview-name.sh` を deploy と削除で共有する。`git check-ref-format --branch` で検査し、
  `.`・`..`・`-` 始まり・`@{` を含む名前などを拒否する。
- deploy は `cf previews deploy <名前> --prebuilt`(名前は位置引数)。
- 削除は `wrangler preview delete --worker-name dev-tools` を wrangler 設定の無いディレクトリで実行する。
  `..` をそのまま渡すと wrangler の URL が `previews/` を打ち消して Worker 本体の DELETE になるため、この検査は外さない。
  送信されるのは `DELETE /accounts/{id}/workers/workers/dev-tools/previews/{ブランチ名}` だけ
  (`.github/preview/preview-delete.test.mjs` がループバックの模擬 API で確認する)。

## close との競合

deploy と cleanup は同じ concurrency group(`preview-<ブランチ名>`)で直列化し、deploy 直前に PR が open で
head SHA がこの run のものと一致することを確認する。一致しなければ deploy しない。
GitHub は同じ group の待機中 run を新しい run で置き換えることがある。その場合は手動で片付ける。

## 有効化スイッチ

どちらも repository variable で、既定は off。有効化はこの PR では実施しない。
有効化は cleanup → deploy の順に行い、作られた Preview を消せない期間を作らない。

- `PREVIEW_CLEANUP_ENABLED` が `true` のときだけ `preview-cleanup` の job が動く。
- `PREVIEW_DEPLOY_ENABLED` が `true` のときだけ `preview-deploy` の job が動く。

どちらも repository secret `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` が必要(値の登録はこのリポジトリの外で行う)。

## 導入順

1. 基盤 PR を main へマージする。
2. main を JSON ブランチへ取り込む。

`pull_request` は PR ブランチに workflow が必要なため取り込みが要る。`pull_request_target` は既定ブランチの定義で動く。

## 手動の対処

- deploy: owner が該当 run を再実行する。
- 片付け: Actions の `preview-cleanup` を `workflow_dispatch` で、`branch` にブランチ名を指定して実行する。
  同じブランチの open な PR が残っていれば、削除せずに成功終了し、job summary に書く。
  削除の失敗(存在しない Preview を含む)は run の失敗になる。

## 限界と未検証

- deploy 経路は実 CI でも Cloudflare でも未実行。削除は模擬 API での確認だけ。
- 名前の正規化(`/` を含むブランチ名で Cloudflare が名前を変えないか。Preview には名前とは別に slug がある)は未検証。
- 削除・deploy に必要な API token の最小権限は未検証。
- イベントを喪失した場合は自動で回復しない。定期的な照合はしない。
- 手動作成済みの Preview `feat/json-formatter` は Access の redirect により動作未確認。
- PR を閉じたあとの同じブランチへの push では Preview は作られない(`pull_request` が発生しない)。reopen するか新しい PR を開くと、owner の run で作り直される。
- repository secret は同一リポジトリの他の workflow からも参照できる。
- `cf` は beta(`1.0.0-beta.14`)、Worker Previews は open beta。
- action はタグ指定で、SHA 固定ではない。

# preview deploy

PR ごとに Cloudflare の Worker Preview(Worker `dev-tools`)を作成・更新し、PR が閉じられたら削除する仕組み。
すべて GitHub Actions で行い、Workers Builds は使わない。本番 deploy と custom domain は対象外。

## 流れ

1. 作成・更新: `preview-deploy`(`pull_request`: opened / synchronize / reopened、job は 1 つ)。
   PR の head を checkout → `npm ci` → `CLOUDFLARE_PREVIEW_BUILD=true npm run build` →
   `cf previews deploy pr-<PR番号> --prebuilt`(アプリが固定している `cf` を使う)。
2. 削除: `preview-cleanup`(`pull_request_target`: closed)。`wrangler preview delete` で Preview を消す。

## 信頼モデル

- 対象は本人が管理する PR だけ。build と deploy は同じ job で動くため、PR の build コードは deploy step の secret に
  影響しうる。これを受け入れており、secret の隔離は主張しない。
- fork の PR と、owner 以外が起動・再実行した run では job が動かない(`github.actor`・`github.triggering_actor`・
  `github.actor_id` がリポジトリ owner と一致するときだけ)。PR 作者名や commit author は見ない。
- `pull_request` の workflow は PR 側の定義で動くため、これらの条件は PR 側で書き換えられる。本人管理の PR に限る前提で受け入れている。

## 2 つの workflow の信頼境界

| 項目           | preview-deploy                                    | preview-cleanup                                                |
| -------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| 起動           | `pull_request`(opened / synchronize / reopened)   | `pull_request_target`(closed)                                  |
| 実行するコード | PR の head(build を含む)                          | 既定ブランチで版を固定した `wrangler`。PR のコードは実行しない |
| 権限           | `contents: read`、`pull-requests: read`           | `contents: read`                                               |
| secret         | deploy step の `env` だけ                         | 削除 step の `env` だけ                                        |
| 対象           | 同一リポジトリの PR、owner 本人の起動・再実行だけ | head が同じリポジトリの PR だけ                                |

## 名前の規則

Preview 名は `pr-<PR番号>`。

- PR 番号は `env` 経由で渡し、`run:` に直接埋め込まない。
- deploy は `cf previews deploy pr-<PR番号> --prebuilt`(名前は位置引数)。
- 削除は `wrangler preview delete --worker-name dev-tools --name=pr-<PR番号>` を wrangler 設定の無いディレクトリで実行する。

## close との競合

deploy と cleanup は同じ concurrency group(`preview-pr-<PR番号>`)で直列化し、deploy 直前に PR が open で
head SHA がこの run のものと一致することを確認する。一致しなければ deploy しない。
GitHub は同じ group の待機中 run を新しい run で置き換えることがある。その場合は手動で片付ける。

## 有効化

有効化スイッチは無い。main にマージされた時点で、条件(deploy は同一リポジトリの PR かつ owner 本人の起動・再実行、cleanup は上の表の既存条件)を満たせば動く。
repository secret `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` が必要(値の登録はこのリポジトリの外で行う)。
止めたいときは、GitHub の Actions 画面で該当 workflow を disable するか、secret を外す。

## 手動の対処

- deploy: owner が該当 run を再実行する。

## 限界と未検証

- 削除・deploy に必要な API token の最小権限は未検証。
- イベントを喪失した場合は自動で回復しない。定期的な照合はしない。
- PR を閉じたあとの同じブランチへの push では Preview は作られない(`pull_request` が発生しない)。reopen するか新しい PR を開くと、owner の run で作り直される。
- repository secret は同一リポジトリの他の workflow からも参照できる。
- `cf` は beta(`1.0.0-beta.14`)、Worker Previews は open beta。
- action はタグ指定で、SHA 固定ではない。
- 既に存在しない Preview の削除は、code 10025 エラーとして検出し、片付け済みとして扱う。

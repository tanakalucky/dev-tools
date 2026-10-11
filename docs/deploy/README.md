# preview deploy

PR ごとに Cloudflare の Worker Preview(Worker `dev-tools`)を作り、push で更新し、PR が閉じられたら削除する仕組み。
すべて GitHub Actions で行い、Workers Builds は使わない。本番 deploy と custom domain は対象外。
deploy 経路は実 CI でも Cloudflare でも未実行。

## 流れ

1. 作成・更新: `preview-deploy`(`pull_request`: opened / synchronize / reopened、job は 1 つ)。
   PR の head を checkout → `npm ci` → `CLOUDFLARE_PREVIEW_BUILD=true npm run build` →
   `cf previews deploy pr-<PR 番号> --prebuilt`(アプリが固定している `cf 1.0.0-beta.14` を使う)。
   ルートに `package.json` が無い PR(基盤 PR 自身など)では何もしない。
2. 削除: `preview-cleanup`(`pull_request_target`: closed)。base 側のコードで `$RUNNER_TEMP/preview-cleanup` に
   `wrangler 4.149.0` を独立してインストールし、`wrangler preview delete --worker-name dev-tools --name=pr-<PR 番号> --skip-confirmation` で
   Preview を消す。アプリの `package.json` や `package-lock.json` は変更しない。
   存在しない Preview(Cloudflare の `[code: 10025]`)は片付け済みとして扱い、他のエラーは失敗のままにする。

## 信頼モデル

- 対象は本人が管理する PR だけ。build と deploy は同じ job で動くため、PR の build コードは deploy step の secret に
  影響しうる。これを受け入れており、secret の隔離は主張しない。
- fork の PR と、owner 以外が起動・再実行した run では deploy job が動かない(`github.actor`・`github.triggering_actor`・
  `github.actor_id` がリポジトリ owner と一致するときだけ)。PR 作者名や commit author は見ない。
- `pull_request` の workflow は PR 側の定義で動くため、これらの条件は PR 側で書き換えられる。本人管理の PR に限る前提で受け入れている。

## 2 つの workflow の信頼境界

| 項目           | preview-deploy                                    | preview-cleanup                       |
| -------------- | ------------------------------------------------- | ------------------------------------- |
| 起動           | `pull_request`(opened / synchronize / reopened)   | `pull_request_target`(closed)         |
| 実行するコード | PR の head(build を含む)                          | base 側(PR のコードは実行しない)      |
| 権限           | `contents: read`, `pull-requests: read`           | `contents: read`                      |
| secret         | deploy step の `env` だけ                         | 削除 step の `env` だけ               |
| 対象           | 同一リポジトリの PR、owner 本人の起動・再実行だけ | 同一リポジトリの PR(head が同じ repo) |

## 名前の規則

Preview 名は `pr-<PR 番号>`。

- PR 番号は `env` 経由で渡し、`run:` に直接埋め込まない。
- deploy は `cf previews deploy pr-<PR 番号> --prebuilt`(名前は位置引数、`cf 1.0.0-beta.14`)。deploy の直前に
  gh API で PR の状態(open)と head SHA が開始時と一致するかを確認し、変化があれば deploy を中止する。
- 削除は `wrangler preview delete --worker-name dev-tools --name=pr-<PR 番号> --skip-confirmation`(`wrangler 4.149.0`)。
  `cf 1.0.0-beta.14` には `cf previews delete` コマンドが無いため、削除には wrangler を使う。wrangler は
  `$RUNNER_TEMP/preview-cleanup` に独立してインストールされ、この directory から実行する。

## 並行実行の制御

deploy と cleanup は同じ concurrency group(`preview-pr-<PR 番号>`)で直列化する。deploy は `cancel-in-progress: true` で
古い run をキャンセルし、cleanup は `cancel-in-progress: false` で削除を確実に完了させる。さらに、deploy の最終段階で
gh API を使って PR の状態と head SHA を確認し、PR が閉じられたか head が変化した場合は deploy を中止する。
これにより、削除後に遅延した deploy が完了して Preview が復活する事態や、同期イベントで古い head が deploy される事態を防ぐ。

## 有効化

有効化スイッチは無い。main にマージされた時点で、条件(deploy は同一リポジトリの PR かつ owner 本人の起動・再実行、cleanup は同一リポジトリの PR)を満たせば動く。
repository secret `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` が必要(値の登録はこのリポジトリの外で行う)。
止めたいときは、GitHub の Actions 画面で該当 workflow を disable するか、secret を外す。

## 導入順

この変更は `chore/simplify-preview-actions` ブランチで行われ、`feat/json-formatter` をターゲットとしている。
main にはまだアプリが存在しないため、直接 main へのマージは行わない。

1. `chore/simplify-preview-actions` を `feat/json-formatter` へマージする。
2. `feat/json-formatter` を main へマージする(アプリと一緒に)。

`pull_request` は PR ブランチに workflow が必要なため、`feat/json-formatter` への取り込みが要る。

## 手動の対処

- deploy: owner が該当 run を再実行する。
- 片付け: owner が該当 run を再実行する(PR は閉じたままで良い)。

## 限界と未検証

- deploy 経路は実 CI でも Cloudflare でも未実行。
- 削除・deploy に必要な API token の最小権限は未検証。
- イベントを喪失した場合は自動で回復しない。定期的な照合はしない。
- 手動作成済みの Preview `feat/json-formatter` は Access の redirect により動作未確認。
- PR を閉じたあとの同じブランチへの push では Preview は作られない(`pull_request` が発生しない)。reopen するか新しい PR を開くと、owner の run で作り直される。
- repository secret は同一リポジトリの他の workflow からも参照できる。
- `cf` は beta(`1.0.0-beta.14`)、Worker Previews は open beta。
- `wrangler` は 4.149.0 に固定。削除コマンドの後方互換性は未検証。
- action はタグ指定で、SHA 固定ではない。

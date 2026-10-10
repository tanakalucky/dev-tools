# preview deploy

PR のブランチごとに Cloudflare の Worker Preview を作り、push で更新し、PR が閉じられたら削除する仕組み。
本番 deploy と custom domain は対象外。実際の Workers Builds と Cloudflare API での動作は、この文書の時点で検証していない。

## 流れ

1. 作成・更新: Workers Builds(Cloudflare 側)。Worker `dev-tools` に接続したリポジトリの非本番ブランチへの push で、
   Preview 用の build と `cf previews deploy` が走る。このリポジトリに deploy 用の workflow は無い。
2. 削除: `preview-cleanup`(GitHub Actions)。PR が閉じられたとき(または手動)に `wrangler preview delete` で Preview を消す。

## Workers Builds の設定(Cloudflare の dashboard で行う。このリポジトリの変更ではない)

| 項目                     | 値                                            |
| ------------------------ | --------------------------------------------- |
| 接続する Worker          | `dev-tools`(`cloudflare.config.ts` の `name`) |
| 非本番ブランチの build   | `CLOUDFLARE_PREVIEW_BUILD=true npm run build` |
| 非本番ブランチの Preview | `npx cf previews deploy --prebuilt`           |

既定の Preview command(`npx wrangler preview`)は使わない。このアプリは `cf/config`(`cloudflare.config.ts`)と
Cloudflare Vite plugin 2 で Build Output(`.cloudflare/output/v0`)を出し、wrangler 設定ファイルを持たない。
`wrangler preview`(4.149.0 で確認)は Build Output を読めないが、アプリが既に固定している `cf` の
`cf previews deploy --prebuilt` は読める。`--prebuilt` は `CLOUDFLARE_PREVIEW_BUILD=true` で作った出力
(`buildContext.isPreview: true`)でなければ拒否する。

## 名前の規則

Preview 名はブランチ名そのもの(`pr-<n>` は使わない)。

- 作成: `cf previews deploy` は名前を省略すると `WORKERS_CI_BRANCH`(Workers Builds が設定する)→ `GITHUB_HEAD_REF` → … →
  git のブランチ名の順に使う(`cf@1.0.0-beta.14` の配布物で確認)。
- 削除: `preview-cleanup` は PR の `head.ref`(手動実行では入力の `branch`)を `--name` に渡す。

対象の Worker は `--worker-name dev-tools` で固定し、wrangler 設定の無いディレクトリで実行する。
`wrangler preview delete` が呼ぶのは `DELETE /accounts/{id}/workers/workers/dev-tools/previews/{ブランチ名}` だけで、
Worker 本体を消す経路は無い(`.github/preview/preview-delete.test.mjs` で確認)。

## preview-cleanup の信頼境界

| 項目           | 内容                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| 起動           | `pull_request_target`(closed)、`workflow_dispatch`                                         |
| 実行するコード | main の `.github/preview` で版を固定した `wrangler`。PR のコードは checkout も実行もしない |
| 権限           | `contents: read`、`pull-requests: read`                                                    |
| secret         | 削除 step の `env` だけ(`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`)                   |
| 対象           | head が同じリポジトリの PR だけ。fork の PR では job 自体が動かない                        |

- 同じブランチの open な PR が残っていれば削除しない。
- ブランチ名は `env` 経由で渡し、シェルに直接埋め込まない。
- wrangler のテレメトリは `WRANGLER_SEND_METRICS=false`、npm registry への更新確認は `WRANGLER_HIDE_BANNER=true` で止める。

## 有効化スイッチ

リポジトリ変数 `PREVIEW_DEPLOY_ENABLED` が `true` のときだけ `preview-cleanup` のジョブが動く。それ以外は何もしない。

## 手動の片付け

Actions の `preview-cleanup` を `workflow_dispatch` で、`branch` にブランチ名を指定して実行する。
削除の失敗(存在しない Preview を含む)は run の失敗になる。

## 限界と未検証

- イベントを喪失した場合は自動で回復しない。手動の片付けが必要。定期的な照合はしない。
- Workers Builds が Preview command を `cf` に差し替えた構成を受け付けるか、project-local の Wrangler を前提に
  事前チェックしないかは未検証。
- Workers Builds が fork の PR のブランチに Preview を作るかは未検証。作られた場合、この workflow は消さない。
- 実際の Cloudflare API での削除と、存在しない Preview を消したときの応答は未検証(模擬 API での確認だけ)。
- PR が閉じられたあとに同じブランチへ push すると、Workers Builds が Preview を作り直す。
- repository secret は同一リポジトリの他の workflow からも参照できる。この仕組みは secret の隔離を主張しない。
- `cf` は beta(`1.0.0-beta.14`)、Worker Previews は open beta。
- action はタグ指定で、SHA 固定ではない。

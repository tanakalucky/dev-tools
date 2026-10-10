# preview deploy

PR ごとの preview 用 Worker を Cloudflare に deploy し、PR が閉じられたら削除するための仕組み。
本番 deploy と custom domain は対象外。実際の CI と Cloudflare 上での動作は、この文書の時点で検証していない。

## 流れ

1. `preview-build`: PR の `opened` / `synchronize` / `reopened` でビルドし、`.cloudflare/output` を成果物 `preview-output`(保持 1 日)として上げる。`package.json` が無ければ何も上げず成功終了する。
2. `preview-deploy`: `preview-build` の完了で起動する。main 側の helper が API で run と PR を取り直して判定し、成果物を検査・設定を書き換えたうえで `cf deploy --prebuilt --provision=false` を実行する。
3. `preview-cleanup`: PR が閉じられたとき(または手動)に preview 用 Worker を削除する。

## workflow の役割と信頼境界

| workflow             | 実行するコード                                        | 権限                                                     | secret                                |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------------- |
| `preview-build`      | PR の head                                            | `contents: read`                                         | 参照しない                            |
| `preview-deploy`     | main の helper と、検査済みの成果物                   | `contents: read`、`actions: read`、`pull-requests: read` | deploy step と削除 step の `env` だけ |
| `preview-cleanup`    | main の helper(PR のコードは checkout も実行もしない) | `contents: read`、`pull-requests: read`                  | 削除 step の `env` だけ               |
| `preview-infra-test` | main または PR の helper のテスト                     | `contents: read`                                         | 参照しない                            |

成果物は信頼しない入力として扱う。作業ツリーの外に展開し、許可リストで構成・種類・件数・サイズ・設定のキーを検査し、検査済みの値だけで設定 2 ファイルを作り直す。`payload` の値は鵜呑みにせず、判定は run と PR を API で取り直して行う。

## 有効化スイッチ

リポジトリ変数 `PREVIEW_DEPLOY_ENABLED` が `true` のときだけ deploy と cleanup のジョブが動く。それ以外は何もしない。

## 対象 actor の方針

上流の run の `actor` と `triggering_actor` がどちらもリポジトリ owner のときだけ deploy する。commit author と PR 作成者は判定に使わない。head と base は同一リポジトリであること、PR の head SHA が run の SHA と一致することも条件とする。

## 名前の規則

Worker 名は PR 番号だけから作る `dev-tools-pr-<n>`(`n` は先頭が 0 でない 9 桁以下の整数)。設定に書く前に完全一致を検査し、本番名 `dev-tools` は拒否する。

## 手動の再試行と片付け

- 再試行: 対象 PR の `preview-build` を Actions から再実行する(再実行者が owner であること)。
- 片付け: Actions の `preview-cleanup` を `workflow_dispatch` で、`pr_number` を指定して実行する。PR が closed のときだけ削除する。
- 削除の失敗は run を失敗させる。存在しない Worker の削除の挙動は未確認で、成功扱いにしていない。

## 限界

- イベントを喪失した場合は自動で回復しない。手動の再試行・片付けが必要。
- 競合中の PR ではビルドが走らず、preview は更新されない。
- preview は PR の head のビルドであり、マージ結果ではない。
- repository secret は同一リポジトリの他の workflow からも参照できる。この仕組みは secret の隔離を主張しない。
- race-free ではない。deploy 直前と直後に PR を再取得して減らしているが、競合は残りうる。
- `cf` は beta(`1.0.0-beta.14` に固定)。
- 実際の Cloudflare 上の動作は未検証。deploy 先の名前と、認証後の経路で成果物のコードがローカルで評価されないことは、ループバックの模擬 API と偽 token による検証(`upload-path.test.mjs`、cf 1.0.0-beta.14、provision 無効)で確認した範囲に限られ、実際の Cloudflare API では未検証。
- 存在しない Worker の削除の挙動は、模擬 API の 404 応答での観測(失敗終了)だけである。
- `cf` のテレメトリは `CF_SEND_TELEMETRY=false` と `DO_NOT_TRACK=1` で無効化している。
- action はタグ指定で、SHA 固定ではない。

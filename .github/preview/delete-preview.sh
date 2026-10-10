#!/usr/bin/env bash
# preview-cleanup の削除 step と、その回帰テスト(preview-delete.test.mjs)から呼ぶ削除処理。
# 対象は Worker dev-tools の Preview `PREVIEW_NAME`(ブランチ名)だけ。Worker 本体を消す経路は持たない。
set -euo pipefail

name="${PREVIEW_NAME:?PREVIEW_NAME が空です}"

# git のブランチ名として正しいものだけを受け付ける。
# `.` と `..` は wrangler が組み立てる URL で Preview の外(Worker 本体など)を指すため、ここで必ず拒否する。
if [ "$name" = "." ] || [ "$name" = ".." ] || ! git check-ref-format --branch "$name" >/dev/null 2>&1; then
  echo "Preview 名がブランチ名として不正なため削除しません" >&2
  exit 1
fi

here="$(cd "$(dirname "$0")" && pwd)"
# テレメトリを止める。banner を出すと npm registry への更新確認が走るため、それも止める。
export WRANGLER_SEND_METRICS=false
export WRANGLER_HIDE_BANNER=true
exec node "$here/node_modules/wrangler/bin/wrangler.js" \
  preview delete --worker-name dev-tools --name="$name" --skip-confirmation

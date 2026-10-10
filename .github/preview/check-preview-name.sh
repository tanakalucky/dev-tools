#!/usr/bin/env bash
# Preview 名(= ブランチ名)の検査。削除(delete-preview.sh)と deploy(preview-deploy.mjs)が同じ検査を共有する。
# 使い方: check-preview-name.sh <名前>。正しければ 0、不正なら標準エラーに理由を出して 1 で終了する。
set -euo pipefail

name="${1-}"

# git のブランチ名として正しいものだけを受け付ける。
# `.` と `..` は wrangler / cf が組み立てる URL で Preview の外(Worker 本体など)を指すため、ここで必ず拒否する。
# `@{...}` は `git check-ref-format --branch` が「直前のブランチ」へ展開するので、実行場所に依存しないよう拒否する。
case "$name" in
  "" | "." | ".." | *"@{"*)
    echo "Preview 名がブランチ名として不正です" >&2
    exit 1
    ;;
esac
if ! git check-ref-format --branch "$name" >/dev/null 2>&1; then
  echo "Preview 名がブランチ名として不正です" >&2
  exit 1
fi

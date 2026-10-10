// GitHub REST API の読み取りと、step output の書き出し(薄い I/O 層)。

import { appendFile } from "node:fs/promises";

const REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export function assertRepo(repo) {
  if (typeof repo !== "string" || !REPO_PATTERN.test(repo)) {
    throw new Error("リポジトリ名が不正です");
  }
  return repo;
}

/** GET のみ。失敗はステータスだけを含めて throw する(token は出さない)。 */
export async function githubGet(
  apiPath,
  { token, apiUrl = "https://api.github.com", fetchImpl = fetch },
) {
  const response = await fetchImpl(`${apiUrl}${apiPath}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "preview-helper",
    },
  });
  if (!response.ok)
    throw new Error(`GitHub API の取得に失敗しました: ${response.status} ${apiPath}`);
  return response.json();
}

/** `key=value` を GITHUB_OUTPUT に追記し、標準出力にも出す。改行を含む値は拒否する。 */
export async function writeOutputs(values, file = process.env.GITHUB_OUTPUT) {
  let text = "";
  for (const [key, value] of Object.entries(values)) {
    const stringValue = String(value);
    if (!/^[a-z_]+$/.test(key) || /[\r\n]/.test(stringValue)) {
      throw new Error("output の形式が不正です");
    }
    text += `${key}=${stringValue}\n`;
  }
  console.log(text.trimEnd());
  if (file) await appendFile(file, text);
}

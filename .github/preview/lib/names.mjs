// preview 用 Worker の名前規則。名前は PR 番号だけから作る。

const PR_NUMBER_PATTERN = /^[1-9][0-9]{0,8}$/;
const WORKER_NAME_PATTERN = /^dev-tools-pr-[1-9][0-9]{0,8}$/;

/** PR 番号として有効な値(正の整数、最大 9 桁)だけを数値で返す。それ以外は throw。 */
export function parsePrNumber(value) {
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && PR_NUMBER_PATTERN.test(String(value))) {
      return value;
    }
  } else if (typeof value === "string" && PR_NUMBER_PATTERN.test(value)) {
    return Number(value);
  }
  throw new Error("PR 番号が不正です(1 から 999999999 の整数のみ)");
}

/** PR 番号から `dev-tools-pr-<n>` を作る。 */
export function previewWorkerName(prNumber) {
  return `dev-tools-pr-${parsePrNumber(prNumber)}`;
}

/** 名前が `dev-tools-pr-<n>` に完全一致しなければ throw。通れば同じ名前を返す。 */
export function assertPreviewWorkerName(name) {
  if (typeof name !== "string" || !WORKER_NAME_PATTERN.test(name)) {
    throw new Error("preview 用 Worker 名として不正です");
  }
  return name;
}

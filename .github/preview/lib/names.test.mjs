import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPreviewWorkerName, parsePrNumber, previewWorkerName } from "./names.mjs";

test("数値と文字列の PR 番号から名前を作る", () => {
  assert.equal(previewWorkerName(7), "dev-tools-pr-7");
  assert.equal(previewWorkerName("123"), "dev-tools-pr-123");
  assert.equal(previewWorkerName(999999999), "dev-tools-pr-999999999");
});

test("不正な PR 番号を拒否する", () => {
  for (const bad of [
    0,
    -1,
    1.5,
    NaN,
    1e9,
    "0",
    "01",
    "1000000000",
    "",
    " 1",
    "1 ",
    "1\n",
    "a",
    "1e3",
    null,
    undefined,
    {},
    [],
  ]) {
    assert.throws(() => parsePrNumber(bad), undefined, String(bad));
    assert.throws(() => previewWorkerName(bad));
  }
});

test("名前の完全一致だけを許可する", () => {
  assert.equal(assertPreviewWorkerName("dev-tools-pr-12"), "dev-tools-pr-12");
  for (const bad of [
    "dev-tools",
    "",
    " dev-tools-pr-1",
    "dev-tools-pr-1 ",
    "dev-tools-pr-1\n",
    "dev-tools-pr-1\nx",
    "Dev-Tools-PR-1",
    "dev-tools-pr-",
    "dev-tools-pr-01",
    "dev-tools-pr-1000000000",
    "dev-tools-pr-1-x",
    "x-dev-tools-pr-1",
    undefined,
    1,
  ]) {
    assert.throws(() => assertPreviewWorkerName(bad), undefined, JSON.stringify(bad));
  }
});

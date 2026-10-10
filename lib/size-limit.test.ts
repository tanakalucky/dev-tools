import { describe, expect, it } from "vitest";
import { MAX_INPUT_BYTES, checkSizeLimit, utf8ByteLength } from "./size-limit";

describe("MAX_INPUT_BYTES", () => {
  it("is exactly 1 MiB", () => {
    expect(MAX_INPUT_BYTES).toBe(1_048_576);
    expect(MAX_INPUT_BYTES).toBe(1024 * 1024);
  });
});

describe("utf8ByteLength", () => {
  it("counts ASCII as one byte per character", () => {
    expect(utf8ByteLength("")).toBe(0);
    expect(utf8ByteLength("abc")).toBe(3);
  });

  it("counts multibyte characters by UTF-8 bytes, not string length", () => {
    // U+00E9 is 2 bytes, U+3042 is 3 bytes, U+1F600 is 4 bytes (2 UTF-16 units).
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("あ")).toBe(3);
    expect(utf8ByteLength("\u{1F600}")).toBe(4);

    const sample = "aéあ\u{1F600}";
    expect(sample.length).toBe(5);
    expect(utf8ByteLength(sample)).toBe(10);
  });
});

describe("checkSizeLimit", () => {
  it("allows input exactly at the cap", () => {
    const text = "a".repeat(MAX_INPUT_BYTES);
    expect(checkSizeLimit(text)).toEqual({
      ok: true,
      bytes: MAX_INPUT_BYTES,
      limit: MAX_INPUT_BYTES,
    });
  });

  it("rejects input one byte over the cap", () => {
    const text = "a".repeat(MAX_INPUT_BYTES + 1);
    expect(checkSizeLimit(text)).toEqual({
      ok: false,
      bytes: MAX_INPUT_BYTES + 1,
      limit: MAX_INPUT_BYTES,
      overBy: 1,
    });
  });

  it("rejects multibyte input whose string length is under the cap", () => {
    // 349_526 three-byte characters = 1_048_578 bytes, two bytes over the cap.
    const text = "あ".repeat(349_526);
    expect(text.length).toBeLessThan(MAX_INPUT_BYTES);

    const result = checkSizeLimit(text);
    expect(result.ok).toBe(false);
    expect(result.bytes).toBe(1_048_578);
    expect(result).toMatchObject({ overBy: 2 });
  });

  it("allows multibyte input that lands exactly on the cap", () => {
    // 349_525 three-byte characters = 1_048_575 bytes, plus one ASCII byte.
    const text = "あ".repeat(349_525) + "a";
    expect(checkSizeLimit(text)).toEqual({
      ok: true,
      bytes: MAX_INPUT_BYTES,
      limit: MAX_INPUT_BYTES,
    });
  });

  it("does not parse the content", () => {
    expect(checkSizeLimit("{ not valid json").ok).toBe(true);
  });

  it("honours an explicit limit", () => {
    expect(checkSizeLimit("abcd", 4).ok).toBe(true);
    expect(checkSizeLimit("abcde", 4)).toMatchObject({ ok: false, overBy: 1 });
  });
});

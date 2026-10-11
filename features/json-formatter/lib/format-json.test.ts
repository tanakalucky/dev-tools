import { describe, expect, it } from "vitest";

import { formatJson } from "./format-json";

// 入力は String.raw で「利用者が貼り付ける文字そのまま」を表す。

describe("formatJson: ordinary JSON", () => {
  it("pretty prints with two spaces", () => {
    const result = formatJson('{"a":[1,2],"b":{"c":null}}');

    expect(result).toEqual({
      ok: true,
      formatted: '{\n  "a": [\n    1,\n    2\n  ],\n  "b": {\n    "c": null\n  }\n}',
    });
  });

  it("keeps escapes inside valid JSON strings as they are", () => {
    const input = String.raw`{"quote":"say \"hi\"","path":"C:\\dir"}`;

    const result = formatJson(input);

    expect(result).toEqual({
      ok: true,
      formatted: [
        "{",
        String.raw`  "quote": "say \"hi\"",`,
        String.raw`  "path": "C:\\dir"`,
        "}",
      ].join("\n"),
    });
  });

  it("does not unwrap an outer JSON string", () => {
    const input = String.raw`"{\"a\":1}"`;

    const result = formatJson(input);

    expect(result).toEqual({ ok: true, formatted: input });
  });
});

describe("formatJson: bare terminal form", () => {
  it("removes one backslash before each quote", () => {
    const result = formatJson(String.raw`{\"name\":\"test\"}`);

    expect(result).toEqual({ ok: true, formatted: '{\n  "name": "test"\n}' });
  });

  it("formats an escaped-quote array after leading whitespace", () => {
    const result = formatJson(String.raw`  [\"first\",\"second\"]`);

    expect(result).toEqual({ ok: true, formatted: '[\n  "first",\n  "second"\n]' });
  });

  it("preserves literal backslashes inside strings", () => {
    // 元の JSON: {"path":"C:\\dir"}
    const result = formatJson(String.raw`{\"path\":\"C:\\dir\"}`);

    expect(result).toEqual({
      ok: true,
      formatted: ["{", String.raw`  "path": "C:\\dir"`, "}"].join("\n"),
    });
    expect(parsePath(result)).toBe(String.raw`C:\dir`);
  });

  it("preserves a literal backslash directly before the closing quote", () => {
    // 元の JSON: {"path":"C:\\"}
    const result = formatJson(String.raw`{\"path\":\"C:\\\"}`);

    expect(parsePath(result)).toBe("C:\\");
  });

  it("keeps an escaped newline as a JSON escape", () => {
    // 元の JSON: {"text":"line1\nline2"}
    const result = formatJson(String.raw`{\"text\":\"line1\nline2\"}`);

    expect(result).toEqual({
      ok: true,
      formatted: ["{", String.raw`  "text": "line1\nline2"`, "}"].join("\n"),
    });
  });

  it("restores a quote inside a value", () => {
    // 元の JSON: {"quote":"say \"hi\""}
    const result = formatJson(String.raw`{\"quote\":\"say \\"hi\\"\"}`);

    expect(result).toEqual({
      ok: true,
      formatted: ["{", String.raw`  "quote": "say \"hi\""`, "}"].join("\n"),
    });
  });
});

describe("formatJson: errors", () => {
  it("rejects mixed escaped and unescaped quotes", () => {
    const result = formatJson(String.raw`{\"a\":"b"}`);

    expect(result.ok).toBe(false);
  });

  it("rejects double escaped quotes without decoding recursively", () => {
    const result = formatJson(String.raw`{\\"a\\":1}`);

    expect(result.ok).toBe(false);
  });

  it("does not treat an escaped outer string as a bare object or array", () => {
    expect(formatJson(String.raw`\"text\"`).ok).toBe(false);
  });

  it("rejects terminal form that is still invalid after unescaping", () => {
    const result = formatJson(String.raw`{\"a\":}`);

    expect(result.ok).toBe(false);
  });

  it("rejects invalid input without quotes", () => {
    expect(formatJson("{a:1}").ok).toBe(false);
  });

  it("rejects empty input", () => {
    expect(formatJson("").ok).toBe(false);
  });

  it("reports the error of the original input", () => {
    const input = String.raw`{\"a\":}`;

    const result = formatJson(input);

    expect(result).toEqual({ ok: false, message: expectedParseMessage(input) });
  });
});

function parsePath(result: ReturnType<typeof formatJson>): unknown {
  if (!result.ok) {
    throw new Error(`expected success but got: ${result.message}`);
  }

  return (JSON.parse(result.formatted) as { path: unknown }).path;
}

function expectedParseMessage(input: string): string {
  try {
    JSON.parse(input);
  } catch (error) {
    return (error as Error).message;
  }

  throw new Error("input was expected to be invalid JSON");
}

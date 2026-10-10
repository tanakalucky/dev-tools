import { describe, expect, it } from "vitest";
import { MAX_INPUT_BYTES } from "../size-limit";
import {
  MAX_DEPTH,
  MAX_WRAPPER_LAYERS,
  formatJson,
  formatJsonEncoded,
  minifyJson,
  minifyJsonEncoded,
} from "./index";

// Builds the JSON string literal that wraps `inner`, as a terminal paste would show it.
function wrap(inner: string): string {
  return JSON.stringify(inner);
}

describe("encoded JSON containers", () => {
  it("bounds decoding to one layer", () => {
    expect(MAX_WRAPPER_LAYERS).toBe(1);
  });

  it("decodes an encoded object with escaped quotes", () => {
    const result = formatJsonEncoded('"{\\"a\\":1,\\"b\\":\\"x\\"}"');
    expect(result).toMatchObject({
      ok: true,
      decoded: true,
      layers: 1,
      output: '{\n  "a": 1,\n  "b": "x"\n}',
      source: '{"a":1,"b":"x"}',
    });
  });

  it("keeps real escapes inside inner strings", () => {
    const result = minifyJsonEncoded(wrap('{"p":"C:\\\\dir","q":"a\\nb"}'));
    expect(result).toMatchObject({
      ok: true,
      decoded: true,
      output: '{"p":"C:\\\\dir","q":"a\\nb"}',
    });
  });

  it("accepts encoded newlines between tokens", () => {
    const result = minifyJsonEncoded('"{\\n  \\"a\\": 1\\n}"');
    expect(result).toMatchObject({ ok: true, decoded: true, output: '{"a":1}' });
  });

  it("preserves large number lexemes", () => {
    const result = formatJsonEncoded(wrap('{"n":9007199254740993,"d":0.1000000000000000055511}'));
    expect(result).toMatchObject({
      ok: true,
      output: '{\n  "n": 9007199254740993,\n  "d": 0.1000000000000000055511\n}',
    });
  });

  it("decodes an encoded array", () => {
    expect(minifyJsonEncoded(wrap("[ 1, 2 ]"))).toMatchObject({
      ok: true,
      decoded: true,
      output: "[1,2]",
    });
  });

  it("tolerates JSON whitespace around the outer string", () => {
    expect(minifyJsonEncoded(`\n ${wrap('{"a":1}')} \t`)).toMatchObject({
      ok: true,
      decoded: true,
      output: '{"a":1}',
    });
  });

  it("still warns about duplicate keys, in the decoded text", () => {
    const result = formatJsonEncoded(wrap('{"a":1,"a":2}'));
    expect(result.ok && result.warnings.length).toBe(1);
    expect(result.decoded).toBe(true);
  });

  it.each(['"hello"', '"123"', '"true"', '"null"', '"[not closed"x', "123", "true", "null"])(
    "does not reinterpret %s",
    (source) => {
      expect(formatJsonEncoded(source)).toEqual({ ...formatJson(source), decoded: false });
    },
  );

  it("keeps an ordinary string scalar a string", () => {
    expect(minifyJsonEncoded('"hello"')).toMatchObject({
      ok: true,
      decoded: false,
      output: '"hello"',
    });
  });

  it("does not unwrap a double-encoded wrapper", () => {
    const source = wrap(wrap('{"a":1}'));
    const result = minifyJsonEncoded(source);
    expect(result).toMatchObject({ ok: true, decoded: false, output: source });
  });

  it("fails a malformed encoded container as decoded text, with no partial output", () => {
    const result = formatJsonEncoded(wrap('{\n"a" 1}'));
    expect(result).toMatchObject({ ok: false, kind: "syntax", decoded: true, line: 2, column: 5 });
    expect(result).not.toHaveProperty("output");
  });

  it("rejects an oversize original input before decoding", () => {
    const result = formatJsonEncoded(wrap(`["${"a".repeat(MAX_INPUT_BYTES)}"]`));
    expect(result).toMatchObject({ ok: false, kind: "too-large", decoded: false });
  });

  it("rejects an over-depth decoded container", () => {
    const deep = "[".repeat(MAX_DEPTH + 1) + "]".repeat(MAX_DEPTH + 1);
    expect(formatJsonEncoded(wrap(deep))).toMatchObject({
      ok: false,
      kind: "too-deep",
      decoded: true,
    });
  });

  it("with decodeEncoded false behaves exactly like formatJson", () => {
    const source = wrap('{"a":1}');
    expect(formatJsonEncoded(source, { decodeEncoded: false })).toEqual({
      ...formatJson(source),
      decoded: false,
    });
  });

  it("leaves direct objects and arrays identical to the plain functions", () => {
    for (const source of ['{ "a" : 1, "a": 2 }', "[ 1, 2 ]", '{"a" 1}']) {
      expect(formatJsonEncoded(source)).toEqual({ ...formatJson(source), decoded: false });
      expect(minifyJsonEncoded(source)).toEqual({ ...minifyJson(source), decoded: false });
    }
  });
});

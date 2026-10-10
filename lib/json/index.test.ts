import { describe, expect, it } from "vitest";
import { MAX_INPUT_BYTES } from "../size-limit";
import {
  MAX_DEPTH,
  MAX_OUTPUT_LENGTH,
  formatJson,
  minifyJson,
  validateJson,
  type DuplicateKeyWarning,
  type JsonResult,
} from "./index";

function outputOf(result: JsonResult): string {
  if (!result.ok) {
    throw new Error(`expected success, got ${result.kind}: ${result.message}`);
  }
  return result.output;
}

function pretty(source: string): string {
  return outputOf(formatJson(source));
}

function minified(source: string): string {
  return outputOf(minifyJson(source));
}

function warningsOf(source: string): DuplicateKeyWarning[] {
  const result = formatJson(source);
  if (!result.ok) {
    throw new Error(`expected success, got ${result.kind}: ${result.message}`);
  }
  return result.warnings;
}

function syntaxErrorAt(source: string): { line: number; column: number } {
  const result = formatJson(source);
  if (result.ok || result.kind !== "syntax") {
    throw new Error(`expected a syntax error for ${JSON.stringify(source)}`);
  }
  expect(result.source).toBe(source);
  expect(result.message.length).toBeGreaterThan(0);
  return { line: result.line, column: result.column };
}

function syntaxMessage(source: string): string {
  const result = formatJson(source);
  if (result.ok || result.kind !== "syntax") {
    throw new Error(`expected a syntax error for ${JSON.stringify(source)}`);
  }
  return result.message;
}

describe("limits", () => {
  it("exposes the documented constants", () => {
    expect(MAX_DEPTH).toBe(128);
    expect(MAX_OUTPUT_LENGTH).toBe(8 * 1024 * 1024);
  });
});

describe("formatJson pretty output", () => {
  it("indents nested containers with two spaces", () => {
    expect(pretty('{"a":1,"b":[1,2,{"c":null}],"d":{}}')).toBe(
      '{\n  "a": 1,\n  "b": [\n    1,\n    2,\n    {\n      "c": null\n    }\n  ],\n  "d": {}\n}',
    );
  });

  it("re-indents already formatted input", () => {
    expect(pretty('{\n        "a" :\n1 ,\t"b":[ true,false ]\n}')).toBe(
      '{\n  "a": 1,\n  "b": [\n    true,\n    false\n  ]\n}',
    );
  });

  it("preserves raw number spellings", () => {
    expect(pretty("[1e400,9007199254740993,-0,1E+02,1.00]")).toBe(
      "[\n  1e400,\n  9007199254740993,\n  -0,\n  1E+02,\n  1.00\n]",
    );
  });

  it("preserves more number spellings as object values", () => {
    expect(pretty('{"a":0.10,"b":-1.5e-7,"c":123456789012345678901234567890,"d":0E0}')).toBe(
      '{\n  "a": 0.10,\n  "b": -1.5e-7,\n  "c": 123456789012345678901234567890,\n  "d": 0E0\n}',
    );
  });

  it("preserves raw string escape spellings", () => {
    const source = String.raw`["\u0041","\/","/","\ud83d\ude00","\b\f\n\r\t\"\\","\u00e9","\u00E9"]`;
    expect(pretty(source)).toBe(
      [
        "[",
        String.raw`  "\u0041",`,
        String.raw`  "\/",`,
        String.raw`  "/",`,
        String.raw`  "\ud83d\ude00",`,
        String.raw`  "\b\f\n\r\t\"\\",`,
        String.raw`  "\u00e9",`,
        String.raw`  "\u00E9"`,
        "]",
      ].join("\n"),
    );
  });

  it("preserves literal non-ASCII characters", () => {
    expect(pretty('["é","あ","\u{1F600}","\u2028"]')).toBe(
      '[\n  "é",\n  "あ",\n  "\u{1F600}",\n  "\u2028"\n]',
    );
  });

  it("preserves key order and does not sort", () => {
    expect(pretty('{"z":1,"a":2,"10":3,"2":4}')).toBe(
      '{\n  "z": 1,\n  "a": 2,\n  "10": 3,\n  "2": 4\n}',
    );
  });

  it("prints empty containers compactly", () => {
    expect(pretty("[]")).toBe("[]");
    expect(pretty("{}")).toBe("{}");
    expect(pretty("[[],{}]")).toBe("[\n  [],\n  {}\n]");
  });

  it("collapses whitespace inside empty containers", () => {
    expect(pretty("[ ]")).toBe("[]");
    expect(pretty("{ \n\t }")).toBe("{}");
    expect(pretty('{"a":[ ],"b":{ \r\n }}')).toBe('{\n  "a": [],\n  "b": {}\n}');
  });

  it("accepts every top-level primitive", () => {
    expect(pretty('"hi"')).toBe('"hi"');
    expect(pretty("42")).toBe("42");
    expect(pretty("-0")).toBe("-0");
    expect(pretty("true")).toBe("true");
    expect(pretty("false")).toBe("false");
    expect(pretty("null")).toBe("null");
    expect(pretty('""')).toBe('""');
  });

  it("drops surrounding whitespace and newlines", () => {
    expect(pretty(" \n\t 42 \r\n")).toBe("42");
    expect(pretty("\n\n[1]\n\n")).toBe("[\n  1\n]");
  });

  it("keeps whitespace that is inside strings", () => {
    expect(pretty('{"a b" : "c  d "}')).toBe('{\n  "a b": "c  d "\n}');
  });

  it("returns the original source and the mode", () => {
    const source = ' {"a" : 1} ';
    const result = formatJson(source);
    expect(result.ok).toBe(true);
    expect(result.source).toBe(source);
    expect(result.ok && result.mode).toBe("pretty");
  });
});

describe("minifyJson", () => {
  it("removes insignificant whitespace only", () => {
    expect(minified('{ "a" : [ 1 , 2 ] ,\r\n\t"b" : null }')).toBe('{"a":[1,2],"b":null}');
  });

  it("preserves raw number spellings", () => {
    expect(minified("[ 1e400 , 9007199254740993 , -0 , 1E+02 , 1.00 ]")).toBe(
      "[1e400,9007199254740993,-0,1E+02,1.00]",
    );
  });

  it("preserves raw string escapes and inner whitespace", () => {
    expect(minified(String.raw`{ "k\u0020 x" : "a \t\/ b" }`)).toBe(
      String.raw`{"k\u0020 x":"a \t\/ b"}`,
    );
  });

  it("minifies empty containers and primitives", () => {
    expect(minified(" [ ] ")).toBe("[]");
    expect(minified("{\n}")).toBe("{}");
    expect(minified("\n null \n")).toBe("null");
    expect(minified(' "x" ')).toBe('"x"');
  });

  it("keeps duplicate keys and key order", () => {
    expect(minified('{ "b": 1, "a": 2, "b": 3 }')).toBe('{"b":1,"a":2,"b":3}');
  });

  it("returns the original source and the mode", () => {
    const source = "[ 1 ]";
    const result = minifyJson(source);
    expect(result.source).toBe(source);
    expect(result.ok && result.mode).toBe("minify");
  });

  it("rejects the same invalid input as formatJson", () => {
    const result = minifyJson("[1,]");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.kind).toBe("syntax");
  });
});

describe("duplicate keys", () => {
  it("warns on identical keys and keeps both", () => {
    const source = '{"a":1,"a":2}';
    expect(pretty(source)).toBe('{\n  "a": 1,\n  "a": 2\n}');
    const warnings = warningsOf(source);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      kind: "duplicate-key",
      key: "a",
      rawKey: '"a"',
      offset: 7,
      line: 1,
      column: 8,
      firstOffset: 1,
      firstLine: 1,
      firstColumn: 2,
    });
    expect(warnings[0]?.message).toContain("line 1, column 2");
  });

  it("treats an escaped key as equivalent to its decoded form", () => {
    const source = String.raw`{"a":1,"\u0061":2}`;
    expect(pretty(source)).toBe('{\n  "a": 1,\n  "\\u0061": 2\n}');
    const warnings = warningsOf(source);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.key).toBe("a");
    expect(warnings[0]?.rawKey).toBe(String.raw`"\u0061"`);
  });

  it("warns once per repeat after the first", () => {
    const warnings = warningsOf('{"a":1,"a":2,"a":3}');
    expect(warnings.map((warning) => warning.column)).toEqual([8, 14]);
    expect(warnings.map((warning) => warning.firstColumn)).toEqual([2, 2]);
  });

  it("reports line and column on multi-line input", () => {
    const warnings = warningsOf('{\n  "k": 1,\r\n  "k": 2\n}');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ line: 3, column: 3, firstLine: 2, firstColumn: 3 });
  });

  it("treats a nested object as its own scope", () => {
    expect(warningsOf('{"a":{"a":1},"b":{"a":2}}')).toEqual([]);
  });

  it("treats sibling objects in an array as separate scopes", () => {
    expect(warningsOf('[{"a":1},{"a":2}]')).toEqual([]);
  });

  it("finds a duplicate inside a nested object without leaking to the parent", () => {
    const warnings = warningsOf('{"x":{"k":1,"k":2},"k":3}');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.column).toBe(13);
  });

  it("resumes the parent scope after a nested object closes", () => {
    const warnings = warningsOf('{"k":{"z":1},"k":2}');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.column).toBe(14);
  });

  it("does not confuse string values with keys", () => {
    expect(warningsOf('{"a":"a","b":["a","a"]}')).toEqual([]);
  });

  it("does not treat distinct keys as equal", () => {
    expect(warningsOf('{"a":1,"A":2,"a ":3,"":4}')).toEqual([]);
  });

  it("treats prototype-named keys as ordinary keys", () => {
    const source = '{"__proto__":1,"constructor":2,"toString":3,"hasOwnProperty":4,"valueOf":5}';
    expect(warningsOf(source)).toEqual([]);
    expect(minified(source)).toBe(source);
    expect(pretty(source)).toBe(
      '{\n  "__proto__": 1,\n  "constructor": 2,\n  "toString": 3,\n  "hasOwnProperty": 4,\n  "valueOf": 5\n}',
    );
  });

  it("detects duplicate prototype-named keys", () => {
    const warnings = warningsOf('{"__proto__":{},"__proto__":[],"constructor":1,"constructor":2}');
    expect(warnings.map((warning) => warning.key)).toEqual(["__proto__", "constructor"]);
  });

  it("is also reported by minifyJson and validateJson", () => {
    const source = '{"a":1,"a":2}';
    const minifyResult = minifyJson(source);
    expect(minifyResult.ok && minifyResult.warnings).toHaveLength(1);
    const validation = validateJson(source);
    expect(validation.ok && validation.warnings).toHaveLength(1);
  });
});

describe("hostile content", () => {
  it("does not interpret JSON-looking or comment-looking string content", () => {
    const source = String.raw`["</script>","{\"a\":[1,2]}","// not a comment","/* x */","a,b:c]}","'"]`;
    expect(minified(source)).toBe(source);
    expect(pretty(source)).toBe(
      [
        "[",
        '  "</script>",',
        String.raw`  "{\"a\":[1,2]}",`,
        '  "// not a comment",',
        '  "/* x */",',
        '  "a,b:c]}",',
        `  "'"`,
        "]",
      ].join("\n"),
    );
  });

  it("keeps lone surrogate escapes and NUL escapes verbatim", () => {
    const source = String.raw`{"\ud800":"\u0000","\udc00":"\uDFFF"}`;
    expect(minified(source)).toBe(source);
    expect(warningsOf(source)).toEqual([]);
  });

  it("keeps a string ending in an escaped backslash intact", () => {
    const source = String.raw`["a\\","b\\\"c"]`;
    expect(minified(source)).toBe(source);
  });
});

describe("validateJson", () => {
  it("returns the source and no output", () => {
    expect(validateJson(" [1] ")).toEqual({ ok: true, source: " [1] ", warnings: [] });
  });

  it("returns the same failure shape as the formatters", () => {
    expect(validateJson("[1,]")).toEqual(formatJson("[1,]"));
  });
});

describe("syntax error positions", () => {
  it("reports 1-based line and column on a single line", () => {
    expect(syntaxErrorAt('{"a":1,}')).toEqual({ line: 1, column: 8 });
  });

  it("counts LF line breaks", () => {
    expect(syntaxErrorAt('{\n  "a": 1,\n  "b": tru\n}')).toEqual({ line: 3, column: 8 });
  });

  it("counts CRLF as a single line break", () => {
    expect(syntaxErrorAt('{\r\n  "a": 1,\r\n  "b": ?\r\n}')).toEqual({ line: 3, column: 8 });
  });

  it("counts a lone CR as a line break", () => {
    expect(syntaxErrorAt("[\r1,\r?]")).toEqual({ line: 3, column: 1 });
  });

  it("handles mixed line endings", () => {
    expect(syntaxErrorAt("[\n1,\r\n2,\r3,\n\n ?]")).toEqual({ line: 6, column: 2 });
  });

  it("counts columns in UTF-16 code units", () => {
    // U+1F600 is one code point but two UTF-16 code units.
    expect(syntaxErrorAt('["\u{1F600}", ?]')).toEqual({ line: 1, column: 8 });
    expect(syntaxErrorAt('["é", ?]')).toEqual({ line: 1, column: 7 });
  });

  it("reports end-of-input errors just past the last character", () => {
    expect(syntaxErrorAt("[1,\n2")).toEqual({ line: 2, column: 2 });
    expect(syntaxErrorAt("[1,2\n")).toEqual({ line: 2, column: 1 });
  });

  it("reports the earlier grammar error before a later lexical error", () => {
    expect(syntaxErrorAt("[1,] ?")).toEqual({ line: 1, column: 4 });
  });

  it("keeps the source unchanged and includes an offset", () => {
    const source = "[1,\r\n ]";
    const result = formatJson(source);
    expect(result).toMatchObject({
      ok: false,
      kind: "syntax",
      source,
      offset: 6,
      line: 2,
      column: 2,
    });
  });
});

describe("invalid grammar", () => {
  it.each([
    ["empty input", "", 1, 1],
    ["whitespace-only input", "  \n ", 2, 2],
    ["CRLF-only input", "\r\n\r\n", 3, 1],
    ["trailing scalar", "1 2", 1, 3],
    ["trailing container", "[] []", 1, 4],
    ["trailing garbage", "{} x", 1, 4],
    ["trailing comma token", "null,", 1, 5],
    ["trailing comma in array", "[1,]", 1, 4],
    ["trailing comma in object", '{"a":1,}', 1, 8],
    ["lone comma in array", "[,]", 1, 2],
    ["lone comma in object", "{,}", 1, 2],
    ["double comma", "[1,,2]", 1, 4],
    ["line comment", "// c\n1", 1, 1],
    ["block comment", "[1 /* c */]", 1, 4],
    ["hash comment", "# c\n1", 1, 1],
    ["NaN", "NaN", 1, 1],
    ["Infinity", "Infinity", 1, 1],
    ["-Infinity", "-Infinity", 1, 2],
    ["undefined", "undefined", 1, 1],
    ["wrong-case literal", "True", 1, 1],
    ["truncated literal", "nul", 1, 1],
    ["leading zero", "01", 1, 2],
    ["negative leading zero", "-01", 1, 3],
    ["double zero", "[00]", 1, 3],
    ["trailing decimal point", "1.", 1, 3],
    ["leading decimal point", ".5", 1, 1],
    ["empty exponent", "1e", 1, 3],
    ["signed empty exponent", "1e+", 1, 4],
    ["fraction then empty exponent", "[1.5E-]", 1, 7],
    ["bare minus", "-", 1, 2],
    ["leading plus", "+1", 1, 1],
    ["hex number", "0x10", 1, 2],
    ["two decimal points", "1.2.3", 1, 4],
    ["unquoted key", "{a:1}", 1, 2],
    ["numeric key", "{1:2}", 1, 2],
    ["single-quoted key", "{'a':1}", 1, 2],
    ["single-quoted string", "'a'", 1, 1],
    ["invalid escape", String.raw`"\x41"`, 1, 2],
    ["escaped single quote", String.raw`"a\'b"`, 1, 3],
    ["non-hex \\u escape", String.raw`"\u12G4"`, 1, 2],
    ["short \\u escape", String.raw`"\u12"`, 1, 2],
    ["\\u escape cut off by end of input", String.raw`"\u12`, 1, 2],
    ["raw tab in string", '"a\tb"', 1, 3],
    ["raw newline in string", '"a\nb"', 1, 3],
    ["raw NUL in string", '"\u0000"', 1, 2],
    ["unterminated string", '"abc', 1, 1],
    ["unterminated string in array", '["a', 1, 2],
    ["string ending in a backslash", '"abc\\', 1, 1],
    ["unterminated array", "[1,2", 1, 5],
    ["unterminated nested array", "[[1]", 1, 5],
    ["unterminated object", '{"a":1', 1, 7],
    ["object ending after key", '{"a"', 1, 5],
    ["object ending after colon", '{"a":', 1, 6],
    ["missing comma in array", "[1 2]", 1, 4],
    ["missing colon", '{"a" 1}', 1, 6],
    ["missing comma in object", '{"a":1 "b":2}', 1, 8],
    ["missing value", '{"a":}', 1, 6],
    ["mismatched closer", "[1}", 1, 3],
    ["mismatched object closer", '{"a":1]', 1, 7],
    ["stray closer", "]", 1, 1],
    ["stray colon", ":", 1, 1],
    ["byte order mark", "\uFEFF1", 1, 1],
    ["non-JSON whitespace", "\u00A01", 1, 1],
    ["form feed", "\f1", 1, 1],
  ])("rejects %s", (_name, source, line, column) => {
    expect(syntaxErrorAt(source)).toEqual({ line, column });
  });

  it("gives specific messages", () => {
    expect(syntaxMessage("")).toBe("Empty input: expected a JSON value");
    expect(syntaxMessage("1 2")).toBe("Unexpected trailing content after the JSON value");
    expect(syntaxMessage("[1,]")).toBe('Trailing comma before "]" is not allowed');
    expect(syntaxMessage('{"a":1,}')).toBe('Trailing comma before "}" is not allowed');
    expect(syntaxMessage("01")).toBe("Invalid number: leading zeros are not allowed");
    expect(syntaxMessage("1.")).toBe("Invalid number: expected a digit after the decimal point");
    expect(syntaxMessage("1e")).toBe("Invalid number: expected a digit in the exponent");
    expect(syntaxMessage("-")).toBe('Invalid number: expected a digit after "-"');
    expect(syntaxMessage('"abc')).toBe("Unterminated string");
    expect(syntaxMessage("[1")).toBe("Unexpected end of input: unterminated array");
    expect(syntaxMessage('{"a":1')).toBe("Unexpected end of input: unterminated object");
    expect(syntaxMessage('"a\tb"')).toBe("Unescaped control character U+0009 in string");
    expect(syntaxMessage(String.raw`"\x"`)).toBe("Invalid escape sequence in string");
    expect(syntaxMessage(String.raw`"\uZZZZ"`)).toBe(
      "Invalid \\u escape: expected four hexadecimal digits",
    );
    expect(syntaxMessage("{a:1}")).toBe('Unexpected character "a"');
    expect(syntaxMessage("//x")).toBe('Unexpected character "/": comments are not allowed');
    expect(syntaxMessage("'a'")).toBe('Unexpected character "\'": strings must use double quotes');
    expect(syntaxMessage("\uFEFF1")).toBe("Unexpected character U+FEFF");
    expect(syntaxMessage('{"a" 1}')).toBe('Expected ":" after object key');
    expect(syntaxMessage("[1 2]")).toBe('Expected "," or "]"');
    expect(syntaxMessage("{1:2}")).toBe("Expected a double-quoted string key");
  });
});

describe("input size limit", () => {
  it("accepts input exactly at the cap", () => {
    const source = `"${"a".repeat(MAX_INPUT_BYTES - 2)}"`;
    expect(source.length).toBe(MAX_INPUT_BYTES);
    const result = formatJson(source);
    expect(result.ok).toBe(true);
    expect(result.ok && result.output === source).toBe(true);
  });

  it("rejects input one byte over the cap without throwing", () => {
    const source = `"${"a".repeat(MAX_INPUT_BYTES - 1)}"`;
    const result = formatJson(source);
    expect(result).toMatchObject({
      ok: false,
      kind: "too-large",
      bytes: MAX_INPUT_BYTES + 1,
      limit: MAX_INPUT_BYTES,
    });
    expect(result.source).toBe(source);
  });

  it("measures the cap in UTF-8 bytes, not string length", () => {
    // "é" is one UTF-16 unit but two UTF-8 bytes.
    const atCap = `"${"a".repeat(MAX_INPUT_BYTES - 4)}é"`;
    expect(atCap.length).toBe(MAX_INPUT_BYTES - 1);
    expect(minifyJson(atCap).ok).toBe(true);

    const overCap = `"${"a".repeat(MAX_INPUT_BYTES - 3)}é"`;
    expect(overCap.length).toBe(MAX_INPUT_BYTES);
    expect(minifyJson(overCap)).toMatchObject({
      ok: false,
      kind: "too-large",
      bytes: MAX_INPUT_BYTES + 1,
    });
  });

  it("checks size before syntax", () => {
    const result = validateJson("?".repeat(MAX_INPUT_BYTES + 1));
    expect(!result.ok && result.kind).toBe("too-large");
  });
});

describe("nesting depth limit", () => {
  it("accepts exactly 128 nested arrays", () => {
    const source = "[".repeat(128) + "]".repeat(128);
    expect(minified(source)).toBe(source);
    expect(pretty(source).startsWith("[\n  [\n    [")).toBe(true);
  });

  it("rejects 129 nested arrays with a controlled result", () => {
    const source = "[".repeat(129) + "]".repeat(129);
    const result = formatJson(source);
    expect(result).toMatchObject({
      ok: false,
      kind: "too-deep",
      limit: 128,
      offset: 128,
      line: 1,
      column: 129,
    });
    expect(result.source).toBe(source);
  });

  it("counts objects and arrays together", () => {
    const open = '{"a":['.repeat(64);
    const close = "]}".repeat(64);
    expect(validateJson(`${open}${close}`).ok).toBe(true);
    const result = validateJson(`${open}[]${close}`);
    expect(!result.ok && result.kind).toBe("too-deep");
  });

  it("does not count closed siblings toward depth", () => {
    const source = `[${"[],".repeat(500)}{}]`;
    expect(validateJson(source).ok).toBe(true);
  });

  it("does not overflow the stack on very deep hostile input", () => {
    const result = formatJson("[".repeat(500_000));
    expect(!result.ok && result.kind).toBe("too-deep");
    const objects = minifyJson('{"a":'.repeat(100_000));
    expect(!objects.ok && objects.kind).toBe("too-deep");
  });
});

describe("output size bound", () => {
  it("returns an explicit error instead of truncating oversized pretty output", () => {
    // 200k elements at depth 100: every element line carries 200 spaces of indent.
    const source = `${"[".repeat(100)}${"1,".repeat(200_000)}1${"]".repeat(100)}`;
    const result = formatJson(source);
    expect(result).toMatchObject({
      ok: false,
      kind: "output-too-large",
      limit: MAX_OUTPUT_LENGTH,
    });
    expect(result.source).toBe(source);
  });

  it("still minifies the same input, since minified output never grows", () => {
    const source = `${"[".repeat(100)}${"1,".repeat(200_000)}1${"]".repeat(100)}`;
    const result = minifyJson(source);
    expect(result.ok && result.output === source).toBe(true);
  });
});

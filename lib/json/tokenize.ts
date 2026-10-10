export type TokenKind = "{" | "}" | "[" | "]" | ":" | "," | "string" | "number" | "literal";

/** A token is a half-open `[start, end)` range of UTF-16 offsets into the source. */
export type Token = { kind: TokenKind; start: number; end: number };

export type LexError = { offset: number; message: string };

export type TokenizeResult = { tokens: Token[]; error: LexError | null };

const LITERALS = ["true", "false", "null"];

/**
 * Splits `source` into JSON tokens without interpreting them. Scanning stops
 * at the first lexical error; the tokens before it are still returned so the
 * caller can report an earlier grammar error first.
 */
export function tokenize(source: string): TokenizeResult {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source.charAt(i);

    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }

    if (ch === "{" || ch === "}" || ch === "[" || ch === "]" || ch === ":" || ch === ",") {
      tokens.push({ kind: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    let end: number | LexError;
    let kind: TokenKind;
    if (ch === '"') {
      kind = "string";
      end = scanString(source, i);
    } else if (ch === "-" || isDigit(source.charCodeAt(i))) {
      kind = "number";
      end = scanNumber(source, i);
    } else {
      kind = "literal";
      end = scanLiteral(source, i);
    }

    if (typeof end !== "number") {
      return { tokens, error: end };
    }
    tokens.push({ kind, start: i, end });
    i = end;
  }

  return { tokens, error: null };
}

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function isHexDigit(code: number): boolean {
  return isDigit(code) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);
}

function hex4(code: number): string {
  return code.toString(16).toUpperCase().padStart(4, "0");
}

/** Returns the offset just past the closing quote of the string starting at `start`. */
function scanString(source: string, start: number): number | LexError {
  let i = start + 1;
  while (i < source.length) {
    const code = source.charCodeAt(i);
    if (code === 0x22) {
      return i + 1;
    }
    if (code < 0x20) {
      return { offset: i, message: `Unescaped control character U+${hex4(code)} in string` };
    }
    if (code !== 0x5c) {
      i++;
      continue;
    }
    if (i + 1 >= source.length) {
      break;
    }
    const escape = source.charAt(i + 1);
    if (escape === "u") {
      for (let k = 2; k < 6; k++) {
        if (!isHexDigit(source.charCodeAt(i + k))) {
          return { offset: i, message: "Invalid \\u escape: expected four hexadecimal digits" };
        }
      }
      i += 6;
    } else if ('"\\/bfnrt'.includes(escape)) {
      i += 2;
    } else {
      return { offset: i, message: "Invalid escape sequence" };
    }
  }
  return { offset: start, message: "Unterminated string" };
}

/** Returns the offset just past the number starting at `start`. */
function scanNumber(source: string, start: number): number | LexError {
  let i = start;
  if (source.charAt(i) === "-") {
    i++;
    if (!isDigit(source.charCodeAt(i))) {
      const message = source.startsWith("Infinity", i)
        ? "NaN and Infinity are not valid JSON numbers"
        : "Expected a digit after '-'";
      return { offset: i, message };
    }
  }

  if (source.charAt(i) === "0") {
    i++;
    if (isDigit(source.charCodeAt(i))) {
      return { offset: i, message: "Leading zeros are not allowed" };
    }
  } else {
    while (isDigit(source.charCodeAt(i))) {
      i++;
    }
  }

  if (source.charAt(i) === ".") {
    i++;
    if (!isDigit(source.charCodeAt(i))) {
      return { offset: i, message: "Expected a digit after the decimal point" };
    }
    while (isDigit(source.charCodeAt(i))) {
      i++;
    }
  }

  const exponent = source.charAt(i);
  if (exponent === "e" || exponent === "E") {
    i++;
    const sign = source.charAt(i);
    if (sign === "+" || sign === "-") {
      i++;
    }
    if (!isDigit(source.charCodeAt(i))) {
      return { offset: i, message: "Expected a digit in the exponent" };
    }
    while (isDigit(source.charCodeAt(i))) {
      i++;
    }
  }

  return i;
}

/** Matches `true`, `false` or `null`; anything else is described as an error. */
function scanLiteral(source: string, start: number): number | LexError {
  for (const literal of LITERALS) {
    if (source.startsWith(literal, start)) {
      return start + literal.length;
    }
  }
  return { offset: start, message: describeUnexpected(source, start) };
}

function describeUnexpected(source: string, offset: number): string {
  const ch = source.charAt(offset);
  if (ch === "/") {
    return "Comments are not allowed in JSON";
  }
  if (ch === "'") {
    return "Single-quoted strings are not allowed; use double quotes";
  }
  if (source.startsWith("NaN", offset) || source.startsWith("Infinity", offset)) {
    return "NaN and Infinity are not valid JSON numbers";
  }
  if (/^[A-Za-z_$]$/.test(ch)) {
    return "Unexpected identifier; object keys and strings must be double-quoted";
  }
  const code = source.codePointAt(offset) ?? 0;
  if (code > 0x20 && code < 0x7f) {
    return `Unexpected character '${ch}'`;
  }
  return `Unexpected character U+${hex4(code)}`;
}

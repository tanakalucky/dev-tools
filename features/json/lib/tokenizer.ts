import type { Token } from "./types";

export type LexError = { offset: number; message: string };

/** Tokens scanned before the first lexical error, plus that error if any. */
export type TokenizeResult = { tokens: Token[]; error: LexError | null };

const LITERALS = ["true", "false", "null"] as const;
const SIMPLE_ESCAPES = '"\\/bfnrt';

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function isHexDigit(code: number): boolean {
  return isDigit(code) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);
}

function codePointLabel(code: number): string {
  return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

function unexpectedCharacter(source: string, offset: number): LexError {
  const code = source.codePointAt(offset) ?? 0;
  if (code === 0x27) {
    return { offset, message: 'Unexpected character "\'": strings must use double quotes' };
  }
  if (code === 0x2f) {
    return { offset, message: 'Unexpected character "/": comments are not allowed' };
  }
  if (code > 0x20 && code < 0x7f) {
    return { offset, message: `Unexpected character "${String.fromCodePoint(code)}"` };
  }
  return { offset, message: `Unexpected character ${codePointLabel(code)}` };
}

/** Returns the end offset of the string starting at `start`, or an error. */
function scanString(source: string, start: number): number | LexError {
  let i = start + 1;
  while (i < source.length) {
    const code = source.charCodeAt(i);
    if (code === 0x22) {
      return i + 1;
    }
    if (code < 0x20) {
      return {
        offset: i,
        message: `Unescaped control character ${codePointLabel(code)} in string`,
      };
    }
    if (code !== 0x5c) {
      i++;
      continue;
    }
    if (i + 1 >= source.length) {
      break;
    }
    if (source.charCodeAt(i + 1) === 0x75) {
      for (let k = 2; k <= 5; k++) {
        if (!isHexDigit(source.charCodeAt(i + k))) {
          return { offset: i, message: "Invalid \\u escape: expected four hexadecimal digits" };
        }
      }
      i += 6;
      continue;
    }
    if (!SIMPLE_ESCAPES.includes(source.charAt(i + 1))) {
      return { offset: i, message: "Invalid escape sequence in string" };
    }
    i += 2;
  }
  return { offset: start, message: "Unterminated string" };
}

/** Returns the end offset of the number starting at `start`, or an error. */
function scanNumber(source: string, start: number): number | LexError {
  let i = start;
  if (source.charCodeAt(i) === 0x2d) {
    i++;
    if (!isDigit(source.charCodeAt(i))) {
      return { offset: i, message: 'Invalid number: expected a digit after "-"' };
    }
  }
  if (source.charCodeAt(i) === 0x30) {
    i++;
    if (isDigit(source.charCodeAt(i))) {
      return { offset: i, message: "Invalid number: leading zeros are not allowed" };
    }
  } else {
    while (isDigit(source.charCodeAt(i))) {
      i++;
    }
  }
  if (source.charCodeAt(i) === 0x2e) {
    i++;
    if (!isDigit(source.charCodeAt(i))) {
      return { offset: i, message: "Invalid number: expected a digit after the decimal point" };
    }
    while (isDigit(source.charCodeAt(i))) {
      i++;
    }
  }
  const exponent = source.charCodeAt(i);
  if (exponent === 0x65 || exponent === 0x45) {
    i++;
    const sign = source.charCodeAt(i);
    if (sign === 0x2b || sign === 0x2d) {
      i++;
    }
    if (!isDigit(source.charCodeAt(i))) {
      return { offset: i, message: "Invalid number: expected a digit in the exponent" };
    }
    while (isDigit(source.charCodeAt(i))) {
      i++;
    }
  }
  return i;
}

/**
 * Splits `source` into JSON tokens without interpreting any value.
 * Whitespace is exactly space, tab, `\n`, and `\r`; nothing else is skipped.
 */
export function tokenize(source: string): TokenizeResult {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const code = source.charCodeAt(i);
    if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) {
      i++;
      continue;
    }
    const char = source.charAt(i);
    if (
      char === "{" ||
      char === "}" ||
      char === "[" ||
      char === "]" ||
      char === ":" ||
      char === ","
    ) {
      tokens.push({ kind: char, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (code === 0x22 || code === 0x2d || isDigit(code)) {
      const end = code === 0x22 ? scanString(source, i) : scanNumber(source, i);
      if (typeof end !== "number") {
        return { tokens, error: end };
      }
      tokens.push({ kind: code === 0x22 ? "string" : "number", start: i, end });
      i = end;
      continue;
    }
    const literal = LITERALS.find((word) => source.startsWith(word, i));
    if (literal === undefined) {
      return { tokens, error: unexpectedCharacter(source, i) };
    }
    tokens.push({ kind: "literal", start: i, end: i + literal.length });
    i += literal.length;
  }
  return { tokens, error: null };
}

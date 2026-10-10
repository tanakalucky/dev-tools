/** Maximum container nesting (arrays plus objects). Depth 128 is allowed, 129 is not. */
export const MAX_DEPTH = 128;

/**
 * Maximum pretty-printed output size, measured in UTF-16 code units
 * (JavaScript string length). Exactly at the bound is allowed.
 */
export const MAX_OUTPUT_LENGTH = 8_388_608;

/** Lexical token kinds. Structural tokens use their own character as the kind. */
export type TokenKind = "{" | "}" | "[" | "]" | ":" | "," | "string" | "number" | "literal";

/** A token is a half-open `[start, end)` range of UTF-16 offsets into the source. */
export type Token = { kind: TokenKind; start: number; end: number };

/** 1-based line and column. Columns count UTF-16 code units. */
export type Position = { line: number; column: number };

export type DuplicateKeyWarning = {
  kind: "duplicate-key";
  /** Decoded key, used for equality. */
  key: string;
  /** Raw key token exactly as written, including quotes and escapes. */
  rawKey: string;
  message: string;
  offset: number;
  line: number;
  column: number;
  /** Position of the first key in the same object with the same decoded value. */
  firstOffset: number;
  firstLine: number;
  firstColumn: number;
};

export type JsonFailure =
  | { ok: false; kind: "too-large"; message: string; source: string; bytes: number; limit: number }
  | {
      ok: false;
      kind: "syntax";
      message: string;
      source: string;
      offset: number;
      line: number;
      column: number;
    }
  | {
      ok: false;
      kind: "too-deep";
      message: string;
      source: string;
      offset: number;
      line: number;
      column: number;
      limit: number;
    }
  | { ok: false; kind: "output-too-large"; message: string; source: string; limit: number };

export type JsonSuccess = {
  ok: true;
  mode: "pretty" | "minify";
  output: string;
  /** The original input, unchanged. */
  source: string;
  warnings: DuplicateKeyWarning[];
};

export type JsonResult = JsonSuccess | JsonFailure;

export type JsonValidation =
  | { ok: true; source: string; warnings: DuplicateKeyWarning[] }
  | JsonFailure;

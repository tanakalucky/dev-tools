import { checkSizeLimit } from "../size-limit";
import { formatJson, minifyJson, validateJson } from "./index";
import { tokenize } from "./tokenizer";
import type { JsonResult, JsonValidation } from "./types";

/** Exactly one layer of JSON string encoding is ever removed. There is no loop over layers. */
export const MAX_WRAPPER_LAYERS = 1;

export type DecodeOptions = {
  /** Default true. When false the plain functions run on the input unchanged. */
  decodeEncoded?: boolean;
};

/**
 * `decoded: true` means the result was produced from the decoded text, so every `line`, `column`,
 * `offset` and `source` in it refer to the decoded text, not the original input.
 */
export type DecodeMarker =
  | { decoded: false }
  | { decoded: true; layers: typeof MAX_WRAPPER_LAYERS };

export type EncodedResult = JsonResult & DecodeMarker;
export type EncodedValidation = JsonValidation & DecodeMarker;

const NOT_DECODED: DecodeMarker = { decoded: false };
const DECODED: DecodeMarker = { decoded: true, layers: MAX_WRAPPER_LAYERS };

function trimJsonWhitespace(text: string): string {
  return text.replace(/^[ \t\n\r]+/, "").replace(/[ \t\n\r]+$/, "");
}

/**
 * Returns the decoded text when `source` is exactly one JSON string token whose content, after
 * trimming JSON whitespace, begins with `{` or `[`. Otherwise null. The only JSON.parse call is on
 * the outer string token, never on the object or array inside.
 */
export function decodeEncodedContainer(source: string): string | null {
  if (!checkSizeLimit(source).ok) {
    return null;
  }
  const trimmed = trimJsonWhitespace(source);
  if (!trimmed.startsWith('"')) {
    return null;
  }
  const { tokens, error } = tokenize(trimmed);
  if (error !== null || tokens.length !== 1) {
    return null;
  }
  const [token] = tokens;
  if (
    token === undefined ||
    token.kind !== "string" ||
    token.start !== 0 ||
    token.end !== trimmed.length
  ) {
    return null;
  }
  const decoded: unknown = JSON.parse(trimmed);
  if (typeof decoded !== "string") {
    return null;
  }
  const head = trimJsonWhitespace(decoded).charAt(0);
  return head === "{" || head === "[" ? decoded : null;
}

function run<T extends { ok: boolean }>(
  source: string,
  options: DecodeOptions,
  fn: (text: string) => T,
): T & DecodeMarker {
  if (options.decodeEncoded === false) {
    return { ...fn(source), ...NOT_DECODED };
  }
  const decoded = decodeEncodedContainer(source);
  if (decoded === null) {
    return { ...fn(source), ...NOT_DECODED };
  }
  // The decoded text gets the same size, depth and output checks as any input.
  return { ...fn(decoded), ...DECODED };
}

export function validateJsonEncoded(
  source: string,
  options: DecodeOptions = {},
): EncodedValidation {
  return run(source, options, validateJson);
}

export function formatJsonEncoded(source: string, options: DecodeOptions = {}): EncodedResult {
  return run(source, options, formatJson);
}

export function minifyJsonEncoded(source: string, options: DecodeOptions = {}): EncodedResult {
  return run(source, options, minifyJson);
}

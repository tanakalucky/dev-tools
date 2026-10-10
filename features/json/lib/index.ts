import { checkSizeLimit } from "./size-limit";
import { findDuplicateKeys } from "./duplicate-keys";
import { checkGrammar } from "./grammar";
import { printMinified } from "./minify";
import { createLocator } from "./position";
import { printPretty } from "./pretty";
import { tokenize } from "./tokenizer";
import {
  MAX_DEPTH,
  MAX_OUTPUT_LENGTH,
  type DuplicateKeyWarning,
  type JsonFailure,
  type JsonResult,
  type JsonValidation,
  type Token,
} from "./types";

export { MAX_DEPTH, MAX_OUTPUT_LENGTH } from "./types";
export {
  MAX_WRAPPER_LAYERS,
  decodeEncodedContainer,
  formatJsonEncoded,
  minifyJsonEncoded,
  validateJsonEncoded,
} from "./encoded";
export type { DecodeMarker, DecodeOptions, EncodedResult, EncodedValidation } from "./encoded";
export type {
  DuplicateKeyWarning,
  JsonFailure,
  JsonResult,
  JsonSuccess,
  JsonValidation,
  Position,
} from "./types";

type Analysis =
  | { ok: true; tokens: Token[]; warnings: DuplicateKeyWarning[] }
  | { ok: false; failure: JsonFailure };

/** Size check, tokenize, grammar check, then duplicate-key scan. Never throws on bad input. */
function analyze(source: string): Analysis {
  const size = checkSizeLimit(source);
  if (!size.ok) {
    return {
      ok: false,
      failure: {
        ok: false,
        kind: "too-large",
        message: `Input is ${size.bytes} bytes, over the ${size.limit} byte limit`,
        source,
        bytes: size.bytes,
        limit: size.limit,
      },
    };
  }

  const { tokens, error } = tokenize(source);
  // A grammar problem in the tokens before a lexical error comes first in the text.
  const issue = checkGrammar(tokens, source.length, error === null) ?? error;
  if (issue !== null) {
    const { line, column } = createLocator(source)(issue.offset);
    const base = { ok: false as const, message: issue.message, source, offset: issue.offset };
    if ("kind" in issue && issue.kind === "too-deep") {
      return {
        ok: false,
        failure: { ...base, kind: "too-deep", line, column, limit: MAX_DEPTH },
      };
    }
    return { ok: false, failure: { ...base, kind: "syntax", line, column } };
  }

  return { ok: true, tokens, warnings: findDuplicateKeys(source, tokens, createLocator(source)) };
}

/** Validates `source` as one JSON document and reports duplicate-key warnings. */
export function validateJson(source: string): JsonValidation {
  const analysis = analyze(source);
  if (!analysis.ok) {
    return analysis.failure;
  }
  return { ok: true, source, warnings: analysis.warnings };
}

/**
 * Validates `source` and re-indents it with two spaces. Token text (number
 * spelling, string escapes, key order, duplicate keys) is preserved exactly.
 */
export function formatJson(source: string): JsonResult {
  const analysis = analyze(source);
  if (!analysis.ok) {
    return analysis.failure;
  }
  const output = printPretty(source, analysis.tokens, MAX_OUTPUT_LENGTH);
  if (output === null) {
    return {
      ok: false,
      kind: "output-too-large",
      message: `Formatted output would exceed the limit of ${MAX_OUTPUT_LENGTH} UTF-16 code units`,
      source,
      limit: MAX_OUTPUT_LENGTH,
    };
  }
  return { ok: true, mode: "pretty", output, source, warnings: analysis.warnings };
}

/** Validates `source` and removes insignificant whitespace only. */
export function minifyJson(source: string): JsonResult {
  const analysis = analyze(source);
  if (!analysis.ok) {
    return analysis.failure;
  }
  const output = printMinified(source, analysis.tokens);
  return { ok: true, mode: "minify", output, source, warnings: analysis.warnings };
}

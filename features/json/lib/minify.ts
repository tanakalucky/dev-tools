import type { Token } from "./types";

/**
 * Joins validated tokens with no whitespace between them. Every token is
 * copied verbatim from `source`, so the result is never longer than the input.
 */
export function printMinified(source: string, tokens: readonly Token[]): string {
  let output = "";
  for (const token of tokens) {
    output += source.slice(token.start, token.end);
  }
  return output;
}

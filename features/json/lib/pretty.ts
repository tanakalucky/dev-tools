import type { Token } from "./types";

const INDENT = "  ";

/**
 * Pretty-prints validated tokens with two-space indentation and `\n` line
 * breaks. Every token is copied verbatim from `source`; only whitespace
 * between tokens is produced here. Empty containers print as `[]` / `{}`.
 *
 * Returns null (and stops early) if the output would exceed `maxLength`
 * UTF-16 code units. Output is never truncated.
 */
export function printPretty(
  source: string,
  tokens: readonly Token[],
  maxLength: number,
): string | null {
  const indents: string[] = [""];
  const lineBreak = (depth: number): string => {
    let cached = indents[depth];
    if (cached === undefined) {
      cached = `\n${INDENT.repeat(depth)}`;
      indents[depth] = cached;
    }
    return depth === 0 ? "\n" : cached;
  };

  let output = "";
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined) {
      continue;
    }
    const raw = source.slice(token.start, token.end);
    const kind = token.kind;
    if (kind === "{" || kind === "[") {
      output += raw;
      const next = tokens[i + 1]?.kind;
      if (next !== "}" && next !== "]") {
        depth++;
        output += lineBreak(depth);
      }
    } else if (kind === "}" || kind === "]") {
      const previous = tokens[i - 1]?.kind;
      if (previous !== "{" && previous !== "[") {
        depth--;
        output += lineBreak(depth);
      }
      output += raw;
    } else if (kind === ",") {
      output += raw + lineBreak(depth);
    } else if (kind === ":") {
      output += ": ";
    } else {
      output += raw;
    }
    if (output.length > maxLength) {
      return null;
    }
  }
  return output;
}

import type { Token } from "./tokenize";

/** Spaces per nesting level in pretty output. */
const INDENT = 2;

/**
 * Number of whitespace characters pretty-printing adds between the tokens
 * of a valid document. Lets the caller bound the output before building it.
 */
export function measurePrettyWhitespace(tokens: Token[]): number {
  let added = 0;
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const kind = tokens[i]?.kind;
    if (kind === "{" || kind === "[") {
      if (isCloser(tokens[i + 1])) {
        i++;
      } else {
        depth++;
        added += 1 + INDENT * depth;
      }
    } else if (kind === "}" || kind === "]") {
      depth--;
      added += 1 + INDENT * depth;
    } else if (kind === ",") {
      added += 1 + INDENT * depth;
    } else if (kind === ":") {
      added += 1;
    }
  }
  return added;
}

/**
 * Pretty-prints a valid token stream with two-space indentation and LF line
 * breaks, no trailing newline. Every token is copied verbatim from `source`.
 */
export function renderPretty(source: string, tokens: Token[]): string {
  const breaks: string[] = [];
  const lineBreak = (depth: number): string => {
    return (breaks[depth] ??= "\n" + " ".repeat(INDENT * depth));
  };

  const parts: string[] = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) {
      continue;
    }
    const { kind } = token;
    if (kind === "{" || kind === "[") {
      if (isCloser(tokens[i + 1])) {
        parts.push(kind === "{" ? "{}" : "[]");
        i++;
      } else {
        depth++;
        parts.push(kind, lineBreak(depth));
      }
    } else if (kind === "}" || kind === "]") {
      depth--;
      parts.push(lineBreak(depth), kind);
    } else if (kind === ",") {
      parts.push(",", lineBreak(depth));
    } else if (kind === ":") {
      parts.push(": ");
    } else {
      parts.push(source.slice(token.start, token.end));
    }
  }
  return parts.join("");
}

/** Joins the tokens of a valid document verbatim, dropping all whitespace between them. */
export function renderMinified(source: string, tokens: Token[]): string {
  const parts: string[] = [];
  for (const token of tokens) {
    parts.push(source.slice(token.start, token.end));
  }
  return parts.join("");
}

function isCloser(token: Token | undefined): boolean {
  return token?.kind === "}" || token?.kind === "]";
}

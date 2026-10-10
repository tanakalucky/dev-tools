import { MAX_DEPTH, type Token, type TokenKind } from "./types";

export type GrammarIssue = { kind: "syntax" | "too-deep"; offset: number; message: string };

type State = "value" | "valueOrEnd" | "keyOrEnd" | "key" | "colon" | "commaOrEnd" | "done";

type Container = "{" | "[";

function closerOf(container: Container): TokenKind {
  return container === "{" ? "}" : "]";
}

function containerName(container: Container): string {
  return container === "{" ? "object" : "array";
}

/**
 * Checks the token sequence against the JSON grammar using an explicit
 * stack (no recursion), so hostile nesting cannot overflow the call stack.
 *
 * `complete` is false when the tokenizer stopped early at a lexical error;
 * in that case running out of tokens is not reported here, so the caller
 * can report the lexical error instead.
 */
export function checkGrammar(
  tokens: readonly Token[],
  endOffset: number,
  complete: boolean,
): GrammarIssue | null {
  const stack: Container[] = [];
  let state: State = "value";
  let previous: TokenKind | null = null;

  const syntax = (offset: number, message: string): GrammarIssue => ({
    kind: "syntax",
    offset,
    message,
  });
  const afterValue = (): State => (stack.length === 0 ? "done" : "commaOrEnd");

  for (const token of tokens) {
    const kind = token.kind;
    const top = stack[stack.length - 1];

    if (state === "done") {
      return syntax(token.start, "Unexpected trailing content after the JSON value");
    }

    if (state === "colon") {
      if (kind !== ":") {
        return syntax(token.start, 'Expected ":" after object key');
      }
      state = "value";
    } else if (state === "keyOrEnd" || state === "key") {
      if (kind === "string") {
        state = "colon";
      } else if (kind === "}" && state === "keyOrEnd") {
        stack.pop();
        state = afterValue();
      } else if (kind === "}") {
        return syntax(token.start, 'Trailing comma before "}" is not allowed');
      } else {
        return syntax(token.start, "Expected a double-quoted string key");
      }
    } else if (state === "commaOrEnd" && top !== undefined) {
      if (kind === ",") {
        state = top === "{" ? "key" : "value";
      } else if (kind === closerOf(top)) {
        stack.pop();
        state = afterValue();
      } else {
        return syntax(token.start, `Expected "," or "${closerOf(top)}"`);
      }
    } else if (kind === "]" && state === "valueOrEnd") {
      stack.pop();
      state = afterValue();
    } else if (kind === "{" || kind === "[") {
      if (stack.length >= MAX_DEPTH) {
        return {
          kind: "too-deep",
          offset: token.start,
          message: `Nesting is deeper than the limit of ${MAX_DEPTH} containers`,
        };
      }
      stack.push(kind);
      state = kind === "{" ? "keyOrEnd" : "valueOrEnd";
    } else if (kind === "string" || kind === "number" || kind === "literal") {
      state = afterValue();
    } else if (kind === "]" && previous === ",") {
      return syntax(token.start, 'Trailing comma before "]" is not allowed');
    } else {
      return syntax(token.start, `Expected a value but found "${kind}"`);
    }

    previous = kind;
  }

  if (state === "done" || !complete) {
    return null;
  }
  if (tokens.length === 0) {
    return syntax(endOffset, "Empty input: expected a JSON value");
  }
  const open = stack[stack.length - 1];
  if (open === undefined) {
    return syntax(endOffset, "Unexpected end of input: expected a value");
  }
  return syntax(endOffset, `Unexpected end of input: unterminated ${containerName(open)}`);
}

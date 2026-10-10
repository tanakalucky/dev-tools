import { MAX_DEPTH } from "./limits";
import type { LexError, Token } from "./tokenize";

/** A key whose decoded value already appeared earlier in the same object. */
export type DuplicateKey = { key: string; offset: number; firstOffset: number };

export type Validation =
  | { ok: true; duplicates: DuplicateKey[] }
  | { ok: false; code: "syntax" | "too-deep"; offset: number; message: string };

type State =
  | "value"
  | "valueAfterComma"
  | "valueOrEnd"
  | "keyOrEnd"
  | "key"
  | "colon"
  | "commaOrEnd"
  | "end";

/** One open container. `keys` maps decoded key to its first offset; null for arrays. */
type Frame = { closer: "}" | "]"; keys: Map<string, number> | null };

/**
 * Checks the token stream against the JSON grammar with an explicit stack,
 * so nesting never recurses. Grammar errors inside the scanned tokens are
 * reported before `lexError`, which always lies after them in the source.
 */
export function validate(source: string, tokens: Token[], lexError: LexError | null): Validation {
  const stack: Frame[] = [];
  const duplicates: DuplicateKey[] = [];
  let state: State = "value";

  for (const token of tokens) {
    const { kind, start } = token;
    const frame = stack[stack.length - 1];

    switch (state) {
      case "end":
        return syntax(start, "Unexpected content after the JSON value");

      case "colon":
        if (kind !== ":") {
          return syntax(start, "Expected ':' after object key");
        }
        state = "value";
        break;

      case "keyOrEnd":
      case "key":
        if (kind === "string") {
          recordKey(source, token, frame, duplicates);
          state = "colon";
        } else if (kind === "}" && state === "keyOrEnd") {
          stack.pop();
          state = stack.length === 0 ? "end" : "commaOrEnd";
        } else if (kind === "}") {
          return syntax(start, "Trailing comma is not allowed");
        } else {
          return syntax(
            start,
            state === "key" ? "Expected a string key" : "Expected a string key or '}'",
          );
        }
        break;

      case "commaOrEnd":
        if (kind === ",") {
          state = frame?.closer === "}" ? "key" : "valueAfterComma";
        } else if (kind === frame?.closer) {
          stack.pop();
          state = stack.length === 0 ? "end" : "commaOrEnd";
        } else {
          return syntax(start, `Expected ',' or '${frame?.closer ?? ""}'`);
        }
        break;

      default:
        if (kind === "{" || kind === "[") {
          if (stack.length >= MAX_DEPTH) {
            return {
              ok: false,
              code: "too-deep",
              offset: start,
              message: `Nesting is deeper than the limit of ${MAX_DEPTH} containers`,
            };
          }
          stack.push(kind === "{" ? { closer: "}", keys: new Map() } : { closer: "]", keys: null });
          state = kind === "{" ? "keyOrEnd" : "valueOrEnd";
        } else if (kind === "string" || kind === "number" || kind === "literal") {
          state = stack.length === 0 ? "end" : "commaOrEnd";
        } else if (kind === "]" && state === "valueOrEnd") {
          stack.pop();
          state = stack.length === 0 ? "end" : "commaOrEnd";
        } else if (kind === "]" && state === "valueAfterComma") {
          return syntax(start, "Trailing comma is not allowed");
        } else {
          return syntax(start, "Expected a value");
        }
    }
  }

  if (lexError) {
    return syntax(lexError.offset, lexError.message);
  }
  if (tokens.length === 0) {
    return syntax(source.length, "Empty input: expected a JSON value");
  }
  if (state !== "end") {
    return syntax(source.length, "Unexpected end of input");
  }
  return { ok: true, duplicates };
}

function syntax(offset: number, message: string): Validation {
  return { ok: false, code: "syntax", offset, message };
}

/**
 * Tracks `token` as a key of `frame`, comparing keys by decoded value so
 * that `"a"` and `"a"` collide. Only this single, already validated
 * string token is ever decoded.
 */
function recordKey(
  source: string,
  token: Token,
  frame: Frame | undefined,
  duplicates: DuplicateKey[],
): void {
  const keys = frame?.keys;
  if (!keys) {
    return;
  }
  const raw = source.slice(token.start, token.end);
  const key = raw.includes("\\") ? (JSON.parse(raw) as string) : raw.slice(1, -1);
  const firstOffset = keys.get(key);
  if (firstOffset === undefined) {
    keys.set(key, token.start);
  } else {
    duplicates.push({ key, offset: token.start, firstOffset });
  }
}

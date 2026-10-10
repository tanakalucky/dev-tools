import type { DuplicateKeyWarning, Position, Token } from "./types";

/**
 * Decodes one already-validated string token. This is the only place a
 * JSON.parse call sees input text, and it only ever sees a single string
 * token, never the document.
 */
function decodeStringToken(raw: string): string {
  return JSON.parse(raw) as string;
}

/**
 * Finds keys that repeat within the same object, comparing decoded values
 * (so `"a"` and `"a"` collide). Each object is its own scope. Scopes
 * are Maps, so `__proto__`, `constructor`, etc. are ordinary keys.
 *
 * `tokens` must already have passed the grammar check. Nothing is removed,
 * reordered, or renamed; this only reports.
 */
export function findDuplicateKeys(
  source: string,
  tokens: readonly Token[],
  locate: (offset: number) => Position,
): DuplicateKeyWarning[] {
  const warnings: DuplicateKeyWarning[] = [];
  // One entry per open container: a key map for objects, null for arrays.
  const scopes: (Map<string, number> | null)[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === undefined) {
      continue;
    }
    if (token.kind === "{") {
      scopes.push(new Map());
    } else if (token.kind === "[") {
      scopes.push(null);
    } else if (token.kind === "}" || token.kind === "]") {
      scopes.pop();
    } else if (token.kind === "string" && tokens[i + 1]?.kind === ":") {
      const scope = scopes[scopes.length - 1];
      if (scope === undefined || scope === null) {
        continue;
      }
      const rawKey = source.slice(token.start, token.end);
      const key = decodeStringToken(rawKey);
      const firstOffset = scope.get(key);
      if (firstOffset === undefined) {
        scope.set(key, token.start);
        continue;
      }
      const at = locate(token.start);
      const first = locate(firstOffset);
      warnings.push({
        kind: "duplicate-key",
        key,
        rawKey,
        message: `Duplicate key ${rawKey}: the same key first appears at line ${first.line}, column ${first.column}`,
        offset: token.start,
        line: at.line,
        column: at.column,
        firstOffset,
        firstLine: first.line,
        firstColumn: first.column,
      });
    }
  }
  return warnings;
}

/** Maximum accepted input size: 1 MiB, measured in UTF-8 bytes. */
export const MAX_INPUT_BYTES = 1_048_576;

export type SizeCheck =
  | { ok: true; bytes: number; limit: number }
  | { ok: false; bytes: number; limit: number; overBy: number };

const encoder = new TextEncoder();

/** UTF-8 encoded size of `text` in bytes. The content is never parsed. */
export function utf8ByteLength(text: string): number {
  return encoder.encode(text).byteLength;
}

/**
 * Checks `text` against a UTF-8 byte cap without parsing it.
 * A size exactly equal to the cap is allowed.
 */
export function checkSizeLimit(text: string, limit: number = MAX_INPUT_BYTES): SizeCheck {
  const bytes = utf8ByteLength(text);
  if (bytes > limit) {
    return { ok: false, bytes, limit, overBy: bytes - limit };
  }
  return { ok: true, bytes, limit };
}

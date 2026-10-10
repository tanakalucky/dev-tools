import { MAX_INPUT_BYTES } from "./size-limit";

/** Maximum container nesting: 128 open arrays/objects at once is allowed, 129 is not. */
export const MAX_DEPTH = 128;

/**
 * Maximum pretty-printed output size: 8 MiB, measured in UTF-8 bytes.
 * Indentation can multiply the size of deeply nested input, so the output
 * size is computed before rendering and an over-bound result is an error.
 */
export const MAX_OUTPUT_BYTES = MAX_INPUT_BYTES * 8;

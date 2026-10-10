import type { Position } from "./types";

const LF = 0x0a;
const CR = 0x0d;

/**
 * Builds an offset -> position lookup for `source`.
 *
 * Lines and columns are 1-based. Columns count UTF-16 code units, so an
 * astral character (one surrogate pair) advances the column by two.
 * Line breaks are `\n`, `\r\n` (counted once), and a lone `\r`.
 */
export function createLocator(source: string): (offset: number) => Position {
  const lineStarts: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    if (code === LF) {
      lineStarts.push(i + 1);
    } else if (code === CR) {
      if (source.charCodeAt(i + 1) === LF) {
        i++;
      }
      lineStarts.push(i + 1);
    }
  }

  return (offset: number): Position => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if ((lineStarts[mid] ?? 0) <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return { line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
  };
}

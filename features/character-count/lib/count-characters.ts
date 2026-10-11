const NEWLINE_SEGMENTS = new Set(["\n", "\r\n", "\r"]);

const graphemeSegmenter = new Intl.Segmenter();

export function countCharacters(text: string): number {
  let count = 0;

  for (const { segment } of graphemeSegmenter.segment(text)) {
    if (!NEWLINE_SEGMENTS.has(segment)) {
      count += 1;
    }
  }

  return count;
}

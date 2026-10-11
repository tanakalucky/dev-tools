export type WidthDirection = "to-half" | "to-full";

type CharacterPair = [full: string, half: string];

// [全角の先頭, 半角の先頭, 連続する字数]。UnicodeData.txt の <wide> / <narrow> 互換分解の全対応(wide 104 行・narrow 122 行)に一致させる。
// NFKC は丸数字や単位記号など幅と無関係な互換文字まで変えるため、入力全体には使わない。
const CODE_POINT_RUNS: readonly (readonly [full: number, half: number, length: number])[] = [
  [0x3000, 0x0020, 1],
  [0xff01, 0x0021, 94],
  [0xff5f, 0x2985, 2],
  [0x3099, 0xff9e, 2],
  [0x3164, 0xffa0, 1],
  [0x3131, 0xffa1, 30],
  [0x314f, 0xffc2, 6],
  [0x3155, 0xffca, 6],
  [0x315b, 0xffd2, 6],
  [0x3161, 0xffda, 3],
  [0xffe0, 0x00a2, 1],
  [0xffe1, 0x00a3, 1],
  [0xffe2, 0x00ac, 1],
  [0xffe3, 0x00af, 1],
  [0xffe4, 0x00a6, 1],
  [0xffe5, 0x00a5, 1],
  [0xffe6, 0x20a9, 1],
  [0x2502, 0xffe8, 1],
  [0x2190, 0xffe9, 1],
  [0x2191, 0xffea, 1],
  [0x2192, 0xffeb, 1],
  [0x2193, 0xffec, 1],
  [0x25a0, 0xffed, 1],
  [0x25cb, 0xffee, 1],
];

// 半角カタカナ U+FF61〜U+FF9D に 1 字ずつ対応する全角文字。
const HALFWIDTH_KATAKANA_START = 0xff61;
const HALFWIDTH_KATAKANA_FULL_FORMS =
  "。「」、・ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン";

// 半角の「基底 + 濁点/半濁点」を 1 字の全角へまとめる対象。ヰ・ヱに半角形はないため含めない。
const COMPOSABLE_KATAKANA: readonly (readonly [bases: string, combiningMark: string])[] = [
  ["カキクケコサシスセソタチツテトハヒフヘホウワヲ", "゙"],
  ["ハヒフヘホ", "゚"],
];

const WIDTH_MAPS = createWidthMaps();

export function convertWidth(text: string, direction: WidthDirection): string {
  return direction === "to-half" ? toHalfWidth(text) : toFullWidth(text);
}

function toHalfWidth(text: string): string {
  const { composedToHalf, fullToHalf } = WIDTH_MAPS;

  const convertChar = (char: string) => composedToHalf.get(char) ?? fullToHalf.get(char) ?? char;

  return Array.from(text, convertChar).join("");
}

function toFullWidth(text: string): string {
  const { halfToComposed, halfToFull } = WIDTH_MAPS;
  const chars = Array.from(text);
  let converted = "";

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index] ?? "";
    const composed = halfToComposed.get(char + (chars[index + 1] ?? ""));

    if (composed === undefined) {
      converted += halfToFull.get(char) ?? char;
    } else {
      converted += composed;
      index += 1;
    }
  }

  return converted;
}

function createWidthMaps() {
  const fullToHalf = new Map(listWidthPairs());
  const composedToHalf = new Map(listComposedKatakanaPairs(fullToHalf));

  return {
    fullToHalf,
    halfToFull: invert(fullToHalf),
    composedToHalf,
    halfToComposed: invert(composedToHalf),
  };
}

function listWidthPairs(): CharacterPair[] {
  const runPairs = CODE_POINT_RUNS.flatMap(([full, half, length]) =>
    Array.from({ length }, (_, offset): CharacterPair => [
      String.fromCodePoint(full + offset),
      String.fromCodePoint(half + offset),
    ]),
  );
  const katakanaPairs = Array.from(HALFWIDTH_KATAKANA_FULL_FORMS, (full, offset): CharacterPair => [
    full,
    String.fromCodePoint(HALFWIDTH_KATAKANA_START + offset),
  ]);

  return [...runPairs, ...katakanaPairs];
}

// 結合文字との合成は、基底と記号の 2 字だけに NFC を使う。
function listComposedKatakanaPairs(fullToHalf: ReadonlyMap<string, string>): CharacterPair[] {
  return COMPOSABLE_KATAKANA.flatMap(([bases, combiningMark]) =>
    Array.from(bases, (base): CharacterPair => [
      (base + combiningMark).normalize("NFC"),
      (fullToHalf.get(base) ?? base) + (fullToHalf.get(combiningMark) ?? combiningMark),
    ]),
  );
}

function invert(map: ReadonlyMap<string, string>): Map<string, string> {
  return new Map(Array.from(map, ([key, value]): [string, string] => [value, key]));
}

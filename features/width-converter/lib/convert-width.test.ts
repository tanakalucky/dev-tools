import { describe, expect, it } from "vitest";

import { convertWidth } from "./convert-width";

describe("convertWidth: Unicode width pairs", () => {
  it("has the 104 <wide> and 122 <narrow> rows of UnicodeData.txt", () => {
    expect(WIDTH_ROWS.filter((row) => row.kind === "wide")).toHaveLength(104);
    expect(WIDTH_ROWS.filter((row) => row.kind === "narrow")).toHaveLength(122);
  });

  it("converts every pair in both directions and round-trips it", () => {
    const mismatches = WIDTH_ROWS.filter(({ full, half }) => {
      const toHalf = convertWidth(full, "to-half");
      const toFull = convertWidth(half, "to-full");

      return toHalf !== half || toFull !== full;
    }).map(({ full, half }) => `${toCodePoints(full)} <-> ${toCodePoints(half)}`);

    expect(mismatches).toEqual([]);
  });
});

describe("convertWidth: representative text", () => {
  it.each([
    ["ASCII letters, digits and punctuation", "Ｈｅｌｌｏ！ＡＢＣ１２３～", "Hello!ABC123~"],
    ["ideographic space", "ａ　ｂ", "a b"],
    ["halfwidth Katakana and its punctuation", "アイウエオ。「」、・ヲァッー", "ｱｲｳｴｵ｡｢｣､･ｦｧｯｰ"],
    ["Hangul compatibility jamo", "ㄱㅏㅣㅤ", "ﾡￂￜﾠ"],
    ["currency and symbols", "￠￡￢￣￤￦", "¢£¬¯¦₩"],
    ["arrows, box drawing and shapes", "│←↑→↓■○", "￨￩￪￫￬￭￮"],
    ["white parentheses", "｟｠", "⦅⦆"],
  ])("converts %s", (_name, fullWidth, halfWidth) => {
    expect(convertWidth(fullWidth, "to-half")).toBe(halfWidth);
    expect(convertWidth(halfWidth, "to-full")).toBe(fullWidth);
  });
});

describe("convertWidth: voiced and semi-voiced Katakana", () => {
  it.each([
    ["ｶﾞ and ガ", "ｶﾞ", "ガ"],
    ["ﾊﾟ and パ", "ﾊﾟ", "パ"],
    ["ｳﾞ and ヴ", "ｳﾞ", "ヴ"],
    ["ﾜﾞ and ヷ", "ﾜﾞ", "ヷ"],
    ["ｦﾞ and ヺ", "ｦﾞ", "ヺ"],
  ])("converts %s", (_name, halfWidth, composed) => {
    expect(convertWidth(halfWidth, "to-full")).toBe(composed);
    expect(convertWidth(composed, "to-half")).toBe(halfWidth);
  });

  it("composes and decomposes all 28 voiced and semi-voiced characters", () => {
    const composedCharacters = [...COMPOSED_KATAKANA];
    expect(composedCharacters).toHaveLength(28);

    for (const composed of composedCharacters) {
      const decomposed = composed.normalize("NFD");
      const halfWidth = convertWidth(decomposed, "to-half");

      expect(decomposed).toHaveLength(2);
      expect(halfWidth).toHaveLength(2);
      expect(convertWidth(composed, "to-half")).toBe(halfWidth);
      expect(convertWidth(halfWidth, "to-full")).toBe(composed);
    }
  });

  it("converts a base and a separate combining mark the same way", () => {
    expect(convertWidth("ガ", "to-half")).toBe("ｶﾞ");
    expect(convertWidth("パ", "to-half")).toBe("ﾊﾟ");
  });

  it("does not compose a mark that has no composed form", () => {
    expect(convertWidth("ｱﾞ", "to-full")).toBe("ア゙");
    expect(convertWidth("ｲﾞ", "to-full")).toBe("イ゙");
    expect(convertWidth("ｶﾟ", "to-full")).toBe("カ゚");
  });

  it("uses only one mark per base", () => {
    expect(convertWidth("ﾊﾞﾟ", "to-full")).toBe("バ゚");
  });
});

describe("convertWidth: standalone voiced marks", () => {
  it("maps the halfwidth marks to the combining marks, not the spacing ones", () => {
    expect(convertWidth("ﾞﾟ", "to-full")).toBe("゙゚");
    expect(convertWidth("Aﾞ", "to-full")).toBe("Ａ゙");
  });

  it("maps the combining marks back to the halfwidth marks", () => {
    expect(convertWidth("゙゚", "to-half")).toBe("ﾞﾟ");
  });

  it("leaves the spacing marks alone in both directions", () => {
    const spacingMarks = "゛゜";

    expect(convertWidth(spacingMarks, "to-half")).toBe(spacingMarks);
    expect(convertWidth(spacingMarks, "to-full")).toBe(spacingMarks);
  });
});

describe("convertWidth: yen sign and backslash", () => {
  it("keeps the fullwidth yen and the fullwidth backslash apart", () => {
    expect(convertWidth("￥", "to-half")).toBe("¥");
    expect(convertWidth("＼", "to-half")).toBe("\\");
  });

  it("maps the yen sign and the backslash to different fullwidth characters", () => {
    expect(convertWidth("¥", "to-full")).toBe("￥");
    expect(convertWidth("\\", "to-full")).toBe("＼");
  });
});

describe("convertWidth: text without a width pair", () => {
  const UNRELATED_TEXT = "①㈱㌔㍻한글😀あ漢字゛゜\n\t";

  it("keeps it unchanged in both directions", () => {
    expect(convertWidth(UNRELATED_TEXT, "to-half")).toBe(UNRELATED_TEXT);
    expect(convertWidth(UNRELATED_TEXT, "to-full")).toBe(UNRELATED_TEXT);
  });

  it("converts only the width pairs in mixed text", () => {
    expect(convertWidth("Ａ①１㌔ア", "to-half")).toBe("A①1㌔ｱ");
    expect(convertWidth("A①1㌔ｱ", "to-full")).toBe("Ａ①１㌔ア");
  });

  it("keeps unrelated combining marks without normalizing the surrounding text", () => {
    expect(convertWidth("é", "to-full")).toBe("ｅ́");
    expect(convertWidth("ｅ́", "to-half")).toBe("é");
  });

  it("leaves text that is already in the target width unchanged", () => {
    expect(convertWidth("Hello ｱ ¥\\", "to-half")).toBe("Hello ｱ ¥\\");
    expect(convertWidth("Ａ　ア￥", "to-full")).toBe("Ａ　ア￥");
  });

  it("returns an empty string for an empty input", () => {
    expect(convertWidth("", "to-half")).toBe("");
    expect(convertWidth("", "to-full")).toBe("");
  });
});

const COMPOSED_KATAKANA = "ガギグゲゴザジズゼゾダヂヅデドバビブベボヴヷヺパピプペポ";

function toCodePoints(text: string): string {
  return [...text].map((char) => char.codePointAt(0)!.toString(16).toUpperCase()).join(" ");
}

// UnicodeData.txt の互換分解 <wide> / <narrow> の全行(出典: https://www.unicode.org/Public/UCD/latest/ucd/UnicodeData.txt)。
// <wide> の行は全角側が、<narrow> の行は半角側が行頭のコードポイント。
const WIDTH_PAIR_SOURCE = `
3000 wide 0020
FF01 wide 0021
FF02 wide 0022
FF03 wide 0023
FF04 wide 0024
FF05 wide 0025
FF06 wide 0026
FF07 wide 0027
FF08 wide 0028
FF09 wide 0029
FF0A wide 002A
FF0B wide 002B
FF0C wide 002C
FF0D wide 002D
FF0E wide 002E
FF0F wide 002F
FF10 wide 0030
FF11 wide 0031
FF12 wide 0032
FF13 wide 0033
FF14 wide 0034
FF15 wide 0035
FF16 wide 0036
FF17 wide 0037
FF18 wide 0038
FF19 wide 0039
FF1A wide 003A
FF1B wide 003B
FF1C wide 003C
FF1D wide 003D
FF1E wide 003E
FF1F wide 003F
FF20 wide 0040
FF21 wide 0041
FF22 wide 0042
FF23 wide 0043
FF24 wide 0044
FF25 wide 0045
FF26 wide 0046
FF27 wide 0047
FF28 wide 0048
FF29 wide 0049
FF2A wide 004A
FF2B wide 004B
FF2C wide 004C
FF2D wide 004D
FF2E wide 004E
FF2F wide 004F
FF30 wide 0050
FF31 wide 0051
FF32 wide 0052
FF33 wide 0053
FF34 wide 0054
FF35 wide 0055
FF36 wide 0056
FF37 wide 0057
FF38 wide 0058
FF39 wide 0059
FF3A wide 005A
FF3B wide 005B
FF3C wide 005C
FF3D wide 005D
FF3E wide 005E
FF3F wide 005F
FF40 wide 0060
FF41 wide 0061
FF42 wide 0062
FF43 wide 0063
FF44 wide 0064
FF45 wide 0065
FF46 wide 0066
FF47 wide 0067
FF48 wide 0068
FF49 wide 0069
FF4A wide 006A
FF4B wide 006B
FF4C wide 006C
FF4D wide 006D
FF4E wide 006E
FF4F wide 006F
FF50 wide 0070
FF51 wide 0071
FF52 wide 0072
FF53 wide 0073
FF54 wide 0074
FF55 wide 0075
FF56 wide 0076
FF57 wide 0077
FF58 wide 0078
FF59 wide 0079
FF5A wide 007A
FF5B wide 007B
FF5C wide 007C
FF5D wide 007D
FF5E wide 007E
FF5F wide 2985
FF60 wide 2986
FF61 narrow 3002
FF62 narrow 300C
FF63 narrow 300D
FF64 narrow 3001
FF65 narrow 30FB
FF66 narrow 30F2
FF67 narrow 30A1
FF68 narrow 30A3
FF69 narrow 30A5
FF6A narrow 30A7
FF6B narrow 30A9
FF6C narrow 30E3
FF6D narrow 30E5
FF6E narrow 30E7
FF6F narrow 30C3
FF70 narrow 30FC
FF71 narrow 30A2
FF72 narrow 30A4
FF73 narrow 30A6
FF74 narrow 30A8
FF75 narrow 30AA
FF76 narrow 30AB
FF77 narrow 30AD
FF78 narrow 30AF
FF79 narrow 30B1
FF7A narrow 30B3
FF7B narrow 30B5
FF7C narrow 30B7
FF7D narrow 30B9
FF7E narrow 30BB
FF7F narrow 30BD
FF80 narrow 30BF
FF81 narrow 30C1
FF82 narrow 30C4
FF83 narrow 30C6
FF84 narrow 30C8
FF85 narrow 30CA
FF86 narrow 30CB
FF87 narrow 30CC
FF88 narrow 30CD
FF89 narrow 30CE
FF8A narrow 30CF
FF8B narrow 30D2
FF8C narrow 30D5
FF8D narrow 30D8
FF8E narrow 30DB
FF8F narrow 30DE
FF90 narrow 30DF
FF91 narrow 30E0
FF92 narrow 30E1
FF93 narrow 30E2
FF94 narrow 30E4
FF95 narrow 30E6
FF96 narrow 30E8
FF97 narrow 30E9
FF98 narrow 30EA
FF99 narrow 30EB
FF9A narrow 30EC
FF9B narrow 30ED
FF9C narrow 30EF
FF9D narrow 30F3
FF9E narrow 3099
FF9F narrow 309A
FFA0 narrow 3164
FFA1 narrow 3131
FFA2 narrow 3132
FFA3 narrow 3133
FFA4 narrow 3134
FFA5 narrow 3135
FFA6 narrow 3136
FFA7 narrow 3137
FFA8 narrow 3138
FFA9 narrow 3139
FFAA narrow 313A
FFAB narrow 313B
FFAC narrow 313C
FFAD narrow 313D
FFAE narrow 313E
FFAF narrow 313F
FFB0 narrow 3140
FFB1 narrow 3141
FFB2 narrow 3142
FFB3 narrow 3143
FFB4 narrow 3144
FFB5 narrow 3145
FFB6 narrow 3146
FFB7 narrow 3147
FFB8 narrow 3148
FFB9 narrow 3149
FFBA narrow 314A
FFBB narrow 314B
FFBC narrow 314C
FFBD narrow 314D
FFBE narrow 314E
FFC2 narrow 314F
FFC3 narrow 3150
FFC4 narrow 3151
FFC5 narrow 3152
FFC6 narrow 3153
FFC7 narrow 3154
FFCA narrow 3155
FFCB narrow 3156
FFCC narrow 3157
FFCD narrow 3158
FFCE narrow 3159
FFCF narrow 315A
FFD2 narrow 315B
FFD3 narrow 315C
FFD4 narrow 315D
FFD5 narrow 315E
FFD6 narrow 315F
FFD7 narrow 3160
FFDA narrow 3161
FFDB narrow 3162
FFDC narrow 3163
FFE0 wide 00A2
FFE1 wide 00A3
FFE2 wide 00AC
FFE3 wide 00AF
FFE4 wide 00A6
FFE5 wide 00A5
FFE6 wide 20A9
FFE8 narrow 2502
FFE9 narrow 2190
FFEA narrow 2191
FFEB narrow 2192
FFEC narrow 2193
FFED narrow 25A0
FFEE narrow 25CB
`;

const WIDTH_ROWS = WIDTH_PAIR_SOURCE.trim().split("\n").map(parseWidthRow);

function parseWidthRow(line: string) {
  const [compatCode = "", kind = "", baseCode = ""] = line.split(" ");
  const compat = String.fromCodePoint(parseInt(compatCode, 16));
  const base = String.fromCodePoint(parseInt(baseCode, 16));

  return kind === "wide" ? { kind, full: compat, half: base } : { kind, full: base, half: compat };
}

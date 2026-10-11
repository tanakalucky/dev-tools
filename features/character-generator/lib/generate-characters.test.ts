import { describe, expect, it } from "vitest";

import {
  CHARACTER_SETS,
  MAX_LENGTH,
  MIN_LENGTH,
  generateCharacters,
  parseLength,
} from "./generate-characters";

describe("CHARACTER_SETS", () => {
  it("holds exactly the 46 ordinary unvoiced hiragana", () => {
    const expected = [
      "あいうえお",
      "かきくけこ",
      "さしすせそ",
      "たちつてと",
      "なにぬねの",
      "はひふへほ",
      "まみむめも",
      "やゆよ",
      "らりるれろ",
      "わをん",
    ].join("");

    expect(CHARACTER_SETS.hiragana).toBe(expected);
    expect([...CHARACTER_SETS.hiragana]).toHaveLength(46);
    expect(new Set(CHARACTER_SETS.hiragana).size).toBe(46);
  });

  it("holds exactly a-z, A-Z and 0-9", () => {
    const expected = [
      ..."abcdefghijklmnopqrstuvwxyz",
      ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      ..."0123456789",
    ].join("");

    expect(CHARACTER_SETS.alphanumeric).toBe(expected);
    expect(new Set(CHARACTER_SETS.alphanumeric).size).toBe(62);
  });
});

describe("parseLength: accepted values", () => {
  it("accepts the lower and upper bounds", () => {
    expect(parseLength("1")).toBe(MIN_LENGTH);
    expect(parseLength("10000")).toBe(MAX_LENGTH);
  });

  it("accepts an ordinary integer", () => {
    expect(parseLength("10")).toBe(10);
  });
});

describe("parseLength: rejected values", () => {
  it("rejects an empty string", () => {
    expect(parseLength("")).toBeNull();
  });

  it("rejects values outside the range", () => {
    expect(parseLength("0")).toBeNull();
    expect(parseLength("10001")).toBeNull();
    expect(parseLength("-1")).toBeNull();
  });

  it("rejects non-integer notations instead of correcting them", () => {
    expect(parseLength("1.5")).toBeNull();
    expect(parseLength("5.0")).toBeNull();
    expect(parseLength("1e2")).toBeNull();
    expect(parseLength("+5")).toBeNull();
    expect(parseLength("abc")).toBeNull();
    expect(parseLength(" 5")).toBeNull();
    expect(parseLength("５")).toBeNull();
  });

  it("rejects numbers too large to represent exactly", () => {
    expect(parseLength("9".repeat(400))).toBeNull();
  });
});

describe("generateCharacters", () => {
  it("returns exactly the requested number of characters", () => {
    expect(generateCharacters("hiragana", 1)).toHaveLength(1);
    expect(generateCharacters("alphanumeric", 10)).toHaveLength(10);
    expect(generateCharacters("alphanumeric", MAX_LENGTH)).toHaveLength(MAX_LENGTH);
  });

  it("uses only hiragana from the set", () => {
    const generated = generateCharacters("hiragana", MAX_LENGTH);

    expect([...generated].every((char) => CHARACTER_SETS.hiragana.includes(char))).toBe(true);
  });

  it("uses only ASCII letters and digits from the set", () => {
    const generated = generateCharacters("alphanumeric", MAX_LENGTH);

    expect(generated).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it("allows duplicates", () => {
    const generated = generateCharacters("hiragana", MAX_LENGTH);

    expect(new Set(generated).size).toBeLessThan(generated.length);
  });

  it("picks each character independently from the random source", () => {
    const draws = [0, 0, 0.5, 0.999999];
    let next = 0;
    const random = () => draws[next++] ?? 0;

    expect(generateCharacters("alphanumeric", 4, random)).toBe("aaF9");
  });

  it("can reach both ends of each set", () => {
    expect(generateCharacters("hiragana", 2, () => 0)).toBe("ああ");
    expect(generateCharacters("hiragana", 2, () => 0.999999)).toBe("んん");
    expect(generateCharacters("alphanumeric", 2, () => 0.999999)).toBe("99");
  });
});

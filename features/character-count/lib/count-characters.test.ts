import { describe, expect, it } from "vitest";

import { countCharacters } from "./count-characters";

describe("countCharacters: visible characters", () => {
  it("counts an empty string as zero", () => {
    expect(countCharacters("")).toBe(0);
  });

  it("counts ASCII and Japanese text one by one", () => {
    expect(countCharacters("abc")).toBe(3);
    expect(countCharacters("こんにちは")).toBe(5);
  });

  it("counts a combining sequence as one character", () => {
    expect(countCharacters("é")).toBe(1);
  });

  it("counts an emoji ZWJ sequence as one character", () => {
    expect(countCharacters("👨‍👩‍👧‍👦")).toBe(1);
  });

  it("counts a surrogate pair as one character", () => {
    expect(countCharacters("𠮷")).toBe(1);
  });
});

describe("countCharacters: newlines", () => {
  it("excludes LF, CRLF and CR", () => {
    expect(countCharacters("a\nb")).toBe(2);
    expect(countCharacters("a\r\nb")).toBe(2);
    expect(countCharacters("a\rb")).toBe(2);
  });

  it("counts every newline segment as excluded, including consecutive ones", () => {
    expect(countCharacters("\n\r\n\r\n")).toBe(0);
  });
});

describe("countCharacters: whitespace", () => {
  it("includes ASCII spaces", () => {
    expect(countCharacters("a b  c")).toBe(6);
  });

  it("includes full-width spaces", () => {
    expect(countCharacters("あ　い")).toBe(3);
  });

  it("includes tabs", () => {
    expect(countCharacters("a\tb")).toBe(3);
  });

  it("counts whitespace-only text", () => {
    expect(countCharacters(" 　\t")).toBe(3);
  });
});

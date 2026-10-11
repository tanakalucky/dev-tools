import type { NavigationItem } from "@/components/app-shell";

export const JSON_FORMATTER_HREF = "/json";
export const CHARACTER_COUNT_HREF = "/character-count";
export const CHARACTER_GENERATOR_HREF = "/character-generator";
export const WIDTH_CONVERTER_HREF = "/width-converter";
export const CALCULATOR_HREF = "/calculator";

export const tools: NavigationItem[] = [
  { href: JSON_FORMATTER_HREF, label: "JSON整形" },
  { href: CHARACTER_COUNT_HREF, label: "文字数確認" },
  { href: CHARACTER_GENERATOR_HREF, label: "文字生成" },
  { href: WIDTH_CONVERTER_HREF, label: "全角半角" },
  { href: CALCULATOR_HREF, label: "電卓" },
];

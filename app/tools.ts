import type { NavigationItem } from "@/components/app-shell";

export const JSON_FORMATTER_HREF = "/json";
export const CHARACTER_COUNT_HREF = "/character-count";

export const tools: NavigationItem[] = [
  { href: JSON_FORMATTER_HREF, label: "JSON Formatter" },
  { href: CHARACTER_COUNT_HREF, label: "Character Count" },
];

import { AppShell } from "@/components/app-shell";
import { CharacterCount } from "@/features/character-count/components/character-count";

import { CHARACTER_COUNT_HREF, tools } from "../tools";

export const metadata = {
  title: "Character Count | dev-tools",
  description:
    "入力したテキストの文字数を数えます。改行は数えません。入力はブラウザの外へ送信されません。",
};

export default function CharacterCountPage() {
  return (
    <AppShell navigation={tools} currentHref={CHARACTER_COUNT_HREF}>
      <CharacterCount />
    </AppShell>
  );
}

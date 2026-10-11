import { AppShell } from "@/components/app-shell";
import { CharacterGenerator } from "@/features/character-generator/components/character-generator";

import { CHARACTER_GENERATOR_HREF, tools } from "../tools";

export const metadata = {
  title: "Character Generator | dev-tools",
  description:
    "指定した長さのひらがな、または英数字をランダムに生成します。処理はブラウザの中だけで行われます。",
};

export default function CharacterGeneratorPage() {
  return (
    <AppShell navigation={tools} currentHref={CHARACTER_GENERATOR_HREF}>
      <CharacterGenerator />
    </AppShell>
  );
}

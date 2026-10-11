import { AppShell } from "@/components/app-shell";
import { WidthConverter } from "@/features/width-converter/components/width-converter";

import { WIDTH_CONVERTER_HREF, tools } from "../tools";

export const metadata = {
  title: "全角半角変換 | dev-tools",
  description:
    "全角と半角を相互に変換します。変換は「変換する」を押したときだけ行われ、処理はブラウザの中だけで行われます。",
};

export default function WidthConverterPage() {
  return (
    <AppShell navigation={tools} currentHref={WIDTH_CONVERTER_HREF}>
      <WidthConverter />
    </AppShell>
  );
}

import { AppShell } from "@/components/app-shell";
import { Calculator } from "@/features/calculator/components/calculator";

import { CALCULATOR_HREF, tools } from "../tools";

export const metadata = {
  title: "電卓 | dev-tools",
  description:
    "足し算・引き算・掛け算・割り算ができるシンプルな電卓です。処理はブラウザの中だけで行われます。",
};

export default function CalculatorPage() {
  return (
    <AppShell navigation={tools} currentHref={CALCULATOR_HREF}>
      <Calculator />
    </AppShell>
  );
}

import { AppShell } from "@/components/app-shell";
import { JsonFormatter } from "@/features/json-formatter/components/json-formatter";

import { JSON_FORMATTER_HREF, tools } from "../tools";

export const metadata = {
  title: "JSON Formatter | dev-tools",
  description: "JSONを2スペースインデントで整形します。入力はブラウザの外へ送信されません。",
};

export default function JsonPage() {
  return (
    <AppShell navigation={tools} currentHref={JSON_FORMATTER_HREF}>
      <JsonFormatter />
    </AppShell>
  );
}

import { AppShell } from "@/components/app-shell";

import { tools } from "./tools";

export default function HomePage() {
  return (
    <AppShell navigation={tools}>
      <div className="mx-auto max-w-6xl">
        <h1 className="m-0 text-[1.625rem] font-semibold tracking-tight">dev-tools</h1>
        <p className="mt-2 mb-0 text-sm leading-7 text-muted-foreground">
          ブラウザだけで動く開発者向けユーティリティ。
        </p>

        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="mt-8 mb-3 text-lg font-semibold">
            ツール
          </h2>
          <ul className="m-0 list-none p-0">
            {tools.map((tool) => (
              <li key={tool.href}>
                <a href={tool.href} className="text-primary underline underline-offset-4">
                  {tool.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

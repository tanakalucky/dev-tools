import type { ReactNode } from "react";

import { NavigationLink } from "./navigation-link";

export type NavigationItem = { href: string; label: string };

type AppShellProps = {
  navigation: NavigationItem[];
  currentHref?: string;
  children: ReactNode;
};

export function AppShell({ navigation, currentHref, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppBar />

      <div className="flex flex-1 flex-col md:flex-row">
        <SideNavigation navigation={navigation} currentHref={currentHref} />

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function AppBar() {
  return (
    <header className="border-b border-border bg-card px-4 py-4 md:px-6">
      <a href="/" className="inline-flex items-center gap-2.5 text-base font-bold">
        <span
          aria-hidden="true"
          className="grid size-8 -rotate-6 place-items-center rounded-lg bg-accent font-mono text-sm whitespace-nowrap text-primary"
        >
          {"{ }"}
        </span>
        dev tools
      </a>
    </header>
  );
}

// 狭い画面ではサイドバーを隠さず、ヘッダー下の横並びに切り替える。
function SideNavigation({ navigation, currentHref }: Omit<AppShellProps, "children">) {
  return (
    <nav
      aria-label="ツール"
      className="border-b border-border bg-card px-4 py-3 md:w-52 md:shrink-0 md:border-r md:border-b-0 md:px-3.5 md:py-6"
    >
      <p className="mb-3 hidden px-2.5 text-[0.625rem] font-semibold tracking-[0.12em] text-muted-foreground md:block">
        TOOLS
      </p>

      <ul className="m-0 flex min-w-0 list-none flex-wrap gap-1 p-0 md:flex-col md:flex-nowrap">
        {navigation.map((item) => (
          <li key={item.href} className="min-w-0 md:w-full">
            <NavigationLink
              href={item.href}
              label={item.label}
              isCurrent={item.href === currentHref}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

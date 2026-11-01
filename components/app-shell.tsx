import type { ReactNode } from "react";

import { NavigationLink } from "./navigation-link";
import { cn } from "@/lib/utils";

export type NavigationItem = { href: string; label: string };

type AppShellProps = {
  navigation: NavigationItem[];
  currentHref?: string;
  children: ReactNode;
  viewport?: boolean;
};

export function AppShell({ navigation, currentHref, children, viewport = false }: AppShellProps) {
  return (
    <div className={cn("flex min-h-screen flex-col", viewport && "h-dvh min-h-0 overflow-hidden")}>
      <AppBar compact={viewport} />

      <div className={cn("flex flex-1 flex-col md:flex-row", viewport && "min-h-0")}>
        <SideNavigation navigation={navigation} currentHref={currentHref} viewport={viewport} />

        <main
          className={cn(
            "min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8",
            viewport && "min-h-0 overflow-hidden py-2 md:p-4 [@media(max-height:640px)]:p-2",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function AppBar({ compact }: { compact: boolean }) {
  return (
    <header
      className={cn(
        "shrink-0 border-b border-border bg-card px-4 py-4 md:px-6",
        compact && "py-2 md:py-4",
      )}
    >
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
function SideNavigation({ navigation, currentHref, viewport }: Omit<AppShellProps, "children">) {
  return (
    <nav
      aria-label="ツール"
      className={cn(
        "border-b border-border bg-card px-4 py-3 md:w-52 md:shrink-0 md:border-r md:border-b-0 md:px-3.5 md:py-6",
        viewport && "shrink-0 overflow-x-auto py-2 md:shrink md:overflow-y-auto md:py-6",
      )}
    >
      <p className="mb-3 hidden px-2.5 text-[0.625rem] font-semibold tracking-[0.12em] text-muted-foreground md:block">
        TOOLS
      </p>

      <ul
        className={cn(
          "m-0 flex min-w-0 list-none flex-wrap gap-1 p-0 md:flex-col md:flex-nowrap",
          viewport && "flex-nowrap [&>li]:shrink-0",
        )}
      >
        {navigation.map((item) => (
          <li key={item.href} className="min-w-0 md:w-full">
            <NavigationLink
              href={item.href}
              label={item.label}
              isCurrent={item.href === currentHref}
              scrollOnFocus={viewport}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

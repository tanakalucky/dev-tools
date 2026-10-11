"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

type NavigationLinkProps = { href: string; label: string; isCurrent: boolean };

export function NavigationLink({ href, label, isCurrent }: NavigationLinkProps) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [isFullLabelShown, setIsFullLabelShown] = useState(false);

  function showFullLabelIfTruncated() {
    const labelElement = labelRef.current;

    setIsFullLabelShown(
      labelElement !== null && labelElement.scrollWidth > labelElement.clientWidth,
    );
  }

  function hideFullLabel() {
    setIsFullLabelShown(false);
  }

  function hideFullLabelOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape") hideFullLabel();
  }

  return (
    <a
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      onMouseEnter={showFullLabelIfTruncated}
      onMouseLeave={hideFullLabel}
      onFocus={showFullLabelIfTruncated}
      onBlur={hideFullLabel}
      onKeyDown={hideFullLabelOnEscape}
      className={cn(
        "relative flex max-w-full min-w-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
        isCurrent
          ? "bg-accent font-semibold text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <NavigationMark />
      <span ref={labelRef} className="min-w-0 truncate">
        {label}
      </span>

      {isFullLabelShown ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 z-10 flex w-max min-w-full items-center gap-2.5 rounded-lg bg-card px-3 py-2.5 font-semibold text-foreground shadow-md ring-1 ring-border"
        >
          <NavigationMark />
          {label}
        </span>
      ) : null}
    </a>
  );
}

function NavigationMark() {
  return (
    <span aria-hidden="true" className="font-mono">
      {"{ }"}
    </span>
  );
}

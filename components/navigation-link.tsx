"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

type NavigationLinkProps = {
  href: string;
  label: string;
  isCurrent: boolean;
  scrollOnFocus?: boolean;
};

export function NavigationLink({
  href,
  label,
  isCurrent,
  scrollOnFocus = false,
}: NavigationLinkProps) {
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
      onFocus={(event) => {
        showFullLabelIfTruncated();
        if (scrollOnFocus)
          event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
      }}
      onBlur={hideFullLabel}
      onKeyDown={hideFullLabelOnEscape}
      className={cn(
        "relative flex max-w-full min-w-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm whitespace-nowrap transition-colors",
        // 小数のスクロール位置が丸められても、輪郭が領域外へ欠けない余白。
        scrollOnFocus && "scroll-mx-2",
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

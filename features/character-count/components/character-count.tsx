"use client";

import { useEffect, useId, useState } from "react";

import { Textarea } from "@/components/ui/textarea";

import { countCharacters } from "../lib/count-characters";

export function CharacterCount() {
  const inputId = useId();
  const countLabelId = useId();
  const [isReady, setIsReady] = useState(false);
  const [text, setText] = useState("");

  // ハイドレーション前の入力は React の状態に反映されず、文字数と食い違うため受け付けない。
  useEffect(() => setIsReady(true), []);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="m-0 text-[1.625rem] font-semibold tracking-tight">
        Character Count
        <span aria-hidden="true" className="ml-3 text-primary/60">
          ✳
        </span>
      </h1>
      <p className="mt-2 mb-0 text-sm leading-7 text-muted-foreground">
        文字数を、入力と同時に。改行は数えません。
      </p>

      <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_3px_0_var(--border)]">
          <div className="flex h-11 items-center border-b border-border px-4 text-xs font-semibold">
            <label htmlFor={inputId}>テキスト</label>
          </div>
          <Textarea
            id={inputId}
            value={text}
            disabled={!isReady}
            onChange={(event) => setText(event.target.value)}
            placeholder="ここにテキストを入力または貼り付けてください"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="min-h-80 field-sizing-fixed resize-y rounded-none border-0 bg-transparent p-4 text-base leading-7 whitespace-pre-wrap wrap-anywhere focus-visible:ring-inset md:min-h-96 dark:bg-transparent"
          />
        </section>

        <CountPanel labelId={countLabelId} inputId={inputId} count={countCharacters(text)} />
      </div>
    </div>
  );
}

function CountPanel({
  labelId,
  inputId,
  count,
}: {
  labelId: string;
  inputId: string;
  count: number;
}) {
  return (
    <section className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-border bg-accent px-6 py-5 shadow-[0_3px_0_var(--border)]">
      <h2 id={labelId} className="m-0 text-xs font-semibold text-muted-foreground">
        文字数
      </h2>
      <output
        htmlFor={inputId}
        aria-labelledby={labelId}
        className="min-w-0 text-6xl leading-none font-bold break-all tracking-tight text-primary tabular-nums md:text-7xl"
      >
        {count}
      </output>
    </section>
  );
}

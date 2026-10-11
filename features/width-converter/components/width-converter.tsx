"use client";

import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { convertWidth, type WidthDirection } from "../lib/convert-width";

type CopyStatus = "idle" | "copied" | "failed";

const DIRECTION_OPTIONS: { value: WidthDirection; label: string }[] = [
  { value: "to-half", label: "全角 → 半角" },
  { value: "to-full", label: "半角 → 全角" },
];

const PANEL_CLASS =
  "flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_3px_0_var(--border)]";

const TEXT_AREA_CLASS =
  "h-44 field-sizing-fixed resize-none rounded-none border-0 bg-transparent p-4 text-lg leading-8 whitespace-pre-wrap wrap-anywhere focus-visible:ring-inset md:h-68 dark:bg-transparent";

export function WidthConverter() {
  const [isReady, setIsReady] = useState(false);
  const [direction, setDirection] = useState<WidthDirection>("to-half");
  const [text, setText] = useState("");
  const [converted, setConverted] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  // ハイドレーション前の入力・操作は React の状態に反映されないため受け付けない。
  useEffect(() => setIsReady(true), []);

  function handleConvert() {
    setConverted(convertWidth(text, direction));
    setCopyStatus("idle");
  }

  async function handleCopy() {
    if (!converted) {
      return;
    }

    try {
      await navigator.clipboard.writeText(converted);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mt-0 mb-4 text-[0.625rem] text-muted-foreground">
        ツール <span className="mx-2 opacity-50">/</span> 全角半角変換
      </p>

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-xl text-primary md:size-12"
        >
          ⇄
        </span>
        <div>
          <h1 className="m-0 text-[1.625rem] font-semibold tracking-tight">全角半角変換</h1>
          <p className="mt-1 mb-0 text-sm leading-6 text-muted-foreground">
            文字の幅を、使いやすく整える。
          </p>
        </div>
      </div>

      <div className="mt-7 flex items-end justify-between gap-3 md:gap-5">
        <DirectionField isReady={isReady} direction={direction} onDirectionChange={setDirection} />

        <Button
          type="button"
          size="lg"
          className="min-w-24 md:min-w-28"
          disabled={!isReady}
          onClick={handleConvert}
        >
          変換する
          <span aria-hidden="true">→</span>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InputPanel isReady={isReady} text={text} onTextChange={setText} />

        <ResultPanel converted={converted} copyStatus={copyStatus} onCopy={handleCopy} />
      </div>
    </div>
  );
}

function DirectionField({
  isReady,
  direction,
  onDirectionChange,
}: {
  isReady: boolean;
  direction: WidthDirection;
  onDirectionChange: (value: WidthDirection) => void;
}) {
  const directionId = useId();

  return (
    <div className="min-w-0 flex-1 md:max-w-56">
      <label htmlFor={directionId} className="mb-2 block text-xs text-muted-foreground">
        変換の方向
      </label>
      <select
        id={directionId}
        value={direction}
        disabled={!isReady}
        onChange={(event) => {
          const option = DIRECTION_OPTIONS.find(
            (candidate) => candidate.value === event.target.value,
          );

          if (option) {
            onDirectionChange(option.value);
          }
        }}
        className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {DIRECTION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InputPanel({
  isReady,
  text,
  onTextChange,
}: {
  isReady: boolean;
  text: string;
  onTextChange: (value: string) => void;
}) {
  const inputId = useId();

  return (
    <section className={PANEL_CLASS}>
      <div className="flex h-11 items-center border-b border-border px-4 text-xs font-semibold">
        <label htmlFor={inputId}>入力</label>
      </div>

      <Textarea
        id={inputId}
        value={text}
        disabled={!isReady}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="ここに変換したいテキストを入力または貼り付けてください"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        className={TEXT_AREA_CLASS}
      />

      <div className="flex min-h-10 items-center border-t border-border bg-muted px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        <p className="m-0">変換したいテキスト</p>
      </div>
    </section>
  );
}

function ResultPanel({
  converted,
  copyStatus,
  onCopy,
}: {
  converted: string | null;
  copyStatus: CopyStatus;
  onCopy: () => void;
}) {
  const resultId = useId();

  return (
    <section className={PANEL_CLASS}>
      <div className="flex h-11 items-center justify-between gap-3 border-b border-border bg-muted px-4 text-xs font-semibold">
        <label htmlFor={resultId}>変換結果</label>
        <Button type="button" size="sm" variant="outline" disabled={!converted} onClick={onCopy}>
          コピー
        </Button>
      </div>

      <Textarea
        id={resultId}
        readOnly
        value={converted ?? ""}
        spellCheck={false}
        className={`${TEXT_AREA_CLASS} text-primary`}
      />

      <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border bg-muted px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        <p role="status" className="m-0">
          {converted === null ? "「変換する」を押すと、ここに結果が表示されます" : "変換しました"}
        </p>
        <p role="status" className="m-0">
          {copyStatus === "copied" ? "コピーしました" : null}
          {copyStatus === "failed" ? "コピーできませんでした" : null}
        </p>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { formatJson } from "../lib/format-json";

type FormatState =
  | { kind: "idle" }
  | { kind: "formatted"; formatted: string }
  | { kind: "failed"; message: string };

type CopyStatus = "idle" | "copied" | "failed";

const ACTION_BUTTON_CLASS = "px-4";
const PRIMARY_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} shadow-[0_2px_0_color-mix(in_oklch,var(--primary),black_35%)]`;

export function JsonFormatter() {
  const inputId = useId();
  const outputHeadingId = useId();
  const [isReady, setIsReady] = useState(false);
  const [input, setInput] = useState("");
  const [formatState, setFormatState] = useState<FormatState>({ kind: "idle" });
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  // ハイドレーション前のクリックを受け付けないようにする。
  useEffect(() => setIsReady(true), []);

  function handleFormat() {
    const result = formatJson(input);

    setFormatState(
      result.ok
        ? { kind: "formatted", formatted: result.formatted }
        : { kind: "failed", message: result.message },
    );
    setCopyStatus("idle");
  }

  async function handleCopy() {
    if (formatState.kind !== "formatted") {
      return;
    }

    try {
      await navigator.clipboard.writeText(formatState.formatted);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  function handleClear() {
    setInput("");
    setFormatState({ kind: "idle" });
    setCopyStatus("idle");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="m-0 text-[1.625rem] font-semibold tracking-tight">
        JSON Formatter
        <span aria-hidden="true" className="ml-3 text-primary/60">
          ✳
        </span>
      </h1>
      <p className="mt-2 mb-0 text-sm leading-7 text-muted-foreground">JSONを、読みやすく。</p>

      <div className="mt-7 mb-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="lg"
          className={PRIMARY_BUTTON_CLASS}
          disabled={!isReady}
          onClick={handleFormat}
        >
          整形する
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className={ACTION_BUTTON_CLASS}
          disabled={formatState.kind !== "formatted"}
          onClick={handleCopy}
        >
          結果をコピー
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className={ACTION_BUTTON_CLASS}
          onClick={handleClear}
        >
          クリア
        </Button>
        <CopyStatusMessage status={copyStatus} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel header={<label htmlFor={inputId}>入力</label>}>
          <Textarea
            id={inputId}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setFormatState({ kind: "idle" });
              setCopyStatus("idle");
            }}
            placeholder="ここにJSONを貼り付けてください"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            className="min-h-80 flex-1 field-sizing-fixed resize-none rounded-none border-0 bg-transparent p-4 font-mono text-sm leading-7 whitespace-pre-wrap wrap-anywhere focus-visible:ring-inset dark:bg-transparent"
          />
        </Panel>

        <Panel
          header={<h2 id={outputHeadingId}>出力</h2>}
          footer={<OutputStatus formatState={formatState} />}
        >
          <pre
            role="region"
            aria-labelledby={outputHeadingId}
            tabIndex={0}
            className="m-0 h-80 flex-1 overflow-auto p-4 font-mono text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            {formatState.kind === "formatted" ? formatState.formatted : ""}
          </pre>
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_3px_0_var(--border)]">
      <div className="flex h-11 items-center border-b border-border px-4 text-xs font-semibold [&>*]:m-0 [&>*]:text-xs [&>*]:font-semibold">
        {header}
      </div>
      {children}
      {footer}
    </section>
  );
}

function OutputStatus({ formatState }: { formatState: FormatState }) {
  return (
    <div className="min-h-10 border-t border-border bg-muted px-4 py-2.5 text-xs leading-5 text-muted-foreground">
      {formatState.kind === "failed" ? (
        <p role="alert" className="m-0 font-medium text-destructive">
          JSONとして解析できません: {formatState.message}
        </p>
      ) : (
        <p role="status" className="m-0">
          {formatState.kind === "formatted"
            ? "整形しました(インデント2スペース)"
            : "「整形する」を押すと、ここに結果が表示されます"}
        </p>
      )}
    </div>
  );
}

function CopyStatusMessage({ status }: { status: CopyStatus }) {
  return (
    <p role="status" className="m-0 px-1 text-xs text-muted-foreground">
      {status === "copied" ? "コピーしました" : null}
      {status === "failed" ? "コピーできませんでした" : null}
    </p>
  );
}

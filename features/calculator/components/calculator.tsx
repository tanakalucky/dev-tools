"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EQUALS_SYMBOL,
  INITIAL_STATE,
  OPERATOR_SYMBOLS,
  getDisplay,
  parseKeyboardKey,
  pressKey,
  type CalculatorKey,
  type Digit,
  type Display,
} from "../lib/calculator-state";

type CopyStatus = "idle" | "copied" | "failed";

type KeyTone = "digit" | "utility" | "operator" | "equals";

type KeyDefinition = {
  key: CalculatorKey;
  label: string;
  name: string;
  tone: KeyTone;
  isWide?: boolean;
};

type ToneStyle = { variant: "default" | "outline" | "secondary"; className: string };

const COPY_FEEDBACK_MS = 2000;

// 4 列 × 5 行の 18 キー。AC と ＝ だけが 2 列分の幅を持つ。
const KEYS: KeyDefinition[] = [
  { key: "clear", label: "AC", name: "すべてクリア", tone: "utility", isWide: true },
  { key: "backspace", label: "⌫", name: "1文字削除", tone: "utility" },
  { key: "/", label: OPERATOR_SYMBOLS["/"], name: "割る", tone: "operator" },
  digitKey("7"),
  digitKey("8"),
  digitKey("9"),
  { key: "*", label: OPERATOR_SYMBOLS["*"], name: "掛ける", tone: "operator" },
  digitKey("4"),
  digitKey("5"),
  digitKey("6"),
  { key: "-", label: OPERATOR_SYMBOLS["-"], name: "引く", tone: "operator" },
  digitKey("1"),
  digitKey("2"),
  digitKey("3"),
  { key: "+", label: OPERATOR_SYMBOLS["+"], name: "足す", tone: "operator" },
  digitKey("0"),
  { key: ".", label: ".", name: "小数点", tone: "digit" },
  { key: "=", label: EQUALS_SYMBOL, name: "計算結果", tone: "equals", isWide: true },
];

const KEY_CLASS = "h-[3.125rem] w-full min-w-0 px-0 md:h-[3.0625rem]";

const TONE_STYLES: Record<KeyTone, ToneStyle> = {
  digit: { variant: "outline", className: "bg-card text-lg text-muted-foreground" },
  utility: { variant: "secondary", className: "text-xs text-muted-foreground" },
  operator: {
    variant: "secondary",
    className: "bg-accent text-[1.375rem] text-primary hover:bg-accent/70 md:text-[1.4375rem]",
  },
  equals: { variant: "default", className: "text-[1.375rem] md:text-[1.4375rem]" },
};

export function Calculator() {
  const [isReady, setIsReady] = useState(false);
  const [state, dispatch] = useReducer(pressKey, INITIAL_STATE);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const calculatorRef = useRef<HTMLElement>(null);
  const display = getDisplay(state);

  // ハイドレーション前の操作は React の状態に反映されないため受け付けない。
  useEffect(() => setIsReady(true), []);

  const press = useCallback((key: CalculatorKey) => {
    dispatch(key);
    setCopyStatus("idle");
  }, []);

  useEffect(() => {
    const element = calculatorRef.current;

    if (element === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const key = parseKeyboardKey(event.key);

      if (key === null || event.defaultPrevented || event.isComposing) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // フォーカス中のボタンの Enter はブラウザが押下として扱う。ここでも処理すると二重に入力される。
      if (event.key === "Enter" && event.target instanceof HTMLButtonElement) {
        return;
      }

      event.preventDefault();
      press(key);
    }

    element.addEventListener("keydown", handleKeyDown);

    return () => element.removeEventListener("keydown", handleKeyDown);
  }, [press]);

  useEffect(() => {
    if (copyStatus === "idle") {
      return;
    }

    const timer = setTimeout(() => setCopyStatus("idle"), COPY_FEEDBACK_MS);

    return () => clearTimeout(timer);
  }, [copyStatus]);

  async function handleCopy() {
    if (display.copyText === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(display.copyText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="mt-0 mb-4 text-[0.625rem] text-muted-foreground">
        ツール <span className="mx-2 opacity-50">/</span> 電卓
      </p>

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-xl text-primary md:size-12"
        >
          ＋
        </span>
        <div>
          <h1 className="m-0 text-[1.625rem] font-semibold tracking-tight">電卓</h1>
          <p className="mt-1 mb-0 text-sm leading-6 text-muted-foreground">
            ちょっとした計算を、すぐ手元で。
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-center md:mt-7">
        <section
          ref={calculatorRef}
          aria-label="電卓"
          tabIndex={-1}
          className="group/calculator w-[calc(100%-28px)] max-w-[396px] rounded-xl border border-border bg-card p-3.5 transition-colors outline-none focus-within:border-ring md:w-full md:rounded-2xl md:p-[17px]"
        >
          <CalculatorDisplay
            display={display}
            copyStatus={copyStatus}
            canCopy={isReady && display.copyText !== null}
            onCopy={handleCopy}
          />

          <Keypad isReady={isReady} onPress={press} />

          <div className="mx-[3px] mt-[13px] flex items-center justify-between gap-3 text-[0.625rem] text-muted-foreground">
            <p role="status" className="m-0">
              {state.notice ?? "四則演算"}
            </p>
            <KeyboardIndicator />
          </div>
        </section>
      </div>
    </div>
  );
}

function CalculatorDisplay({
  display,
  copyStatus,
  canCopy,
  onCopy,
}: {
  display: Display;
  copyStatus: CopyStatus;
  canCopy: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="min-w-0 rounded-[11px] border border-[#e9dcf8] bg-[#f3ecfc] px-[19px] pt-[15px] pb-[17px] text-right md:px-[21px] md:pt-[17px] md:pb-[19px]">
      <div className="mb-2 flex items-center justify-between gap-2.5">
        <span aria-hidden="true" className="text-[0.9375rem] leading-none text-[#c1a6d9]">
          ✧
        </span>

        <div className="flex items-center gap-2">
          <span role="status" className="text-[0.625rem] text-muted-foreground">
            {copyStatus === "copied" ? "コピーしました" : null}
            {copyStatus === "failed" ? "コピーできませんでした" : null}
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="bg-card"
            disabled={!canCopy}
            onClick={onCopy}
          >
            コピー
          </Button>
        </div>
      </div>

      <p
        data-testid="calculator-expression"
        className="m-0 min-h-[1.6em] text-[0.8125rem] leading-[1.6] tracking-[0.6px] text-muted-foreground tabular-nums wrap-anywhere"
      >
        {display.expression === "" ? null : <span className="sr-only">計算式 </span>}
        {display.expression}
      </p>

      <output
        aria-label="計算結果"
        className={cn(
          "mt-[3px] block font-medium tracking-[-1.5px] tabular-nums wrap-anywhere",
          display.isError
            ? "text-3xl text-destructive"
            : ["text-primary", sizeClass(display.result)],
          "leading-[1.2]",
        )}
      >
        {display.result}
      </output>
    </div>
  );
}

function Keypad({ isReady, onPress }: { isReady: boolean; onPress: (key: CalculatorKey) => void }) {
  return (
    <div
      role="group"
      aria-label="キーパッド"
      className="mt-[13px] grid grid-cols-4 gap-2 md:mt-[15px] md:gap-[9px]"
    >
      {KEYS.map(({ key, label, name, tone, isWide }) => (
        <Button
          key={key}
          type="button"
          variant={TONE_STYLES[tone].variant}
          aria-label={name}
          disabled={!isReady}
          onClick={() => onPress(key)}
          className={cn(
            KEY_CLASS,
            TONE_STYLES[tone].className,
            "disabled:opacity-100",
            isWide && "col-span-2",
          )}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

// 枠の中にフォーカスがあるときだけキーボード入力が効くことを、控えめに示す。
function KeyboardIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-border group-focus-within/calculator:bg-primary"
      />
      <span className="group-focus-within/calculator:hidden">クリックでキーボード入力</span>
      <span className="hidden group-focus-within/calculator:inline">キーボード入力 有効</span>
    </span>
  );
}

function digitKey(digit: Digit): KeyDefinition {
  return { key: digit, label: digit, name: digit, tone: "digit" };
}

// 桁数が増えたら、枠からはみ出さないよう文字を小さくする。
function sizeClass(result: string): string {
  if (result.length <= 9) return "text-[3rem] md:text-[3.1875rem]";
  if (result.length <= 11) return "text-4xl";
  if (result.length <= 14) return "text-[1.75rem]";
  if (result.length <= 20) return "text-xl";

  return "text-base";
}

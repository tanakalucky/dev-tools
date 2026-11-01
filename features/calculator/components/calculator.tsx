"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EQUALS_SYMBOL,
  OPERATOR_SYMBOLS,
  getDisplay,
  parseKeyboardKey,
  parsePastedNumber,
  type CalculatorKey,
  type Digit,
  type Display,
} from "../lib/calculator-state";
import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  INITIAL_SESSION,
  parseHistory,
  reduceSession,
  serializeHistory,
} from "../lib/calculator-history";
import { NumberPasteDialog } from "./number-paste-dialog";

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

const KEY_CLASS =
  "h-full max-h-[3.125rem] min-h-0 w-full min-w-0 px-0 md:max-h-[3.0625rem] [@media(max-height:640px)]:max-h-11";

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
  const [panel, setPanel] = useState<"calculator" | "history">("calculator");
  const [session, dispatch] = useReducer(reduceSession, INITIAL_SESSION);
  const [storageStatus, setStorageStatus] = useState<string | null>(null);
  const storageReadable = useRef(false);
  const lastSaved = useRef<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [isReadingPaste, setIsReadingPaste] = useState(false);
  const [manualPasteOpen, setManualPasteOpen] = useState(false);
  const pasteRequest = useRef(0);
  const calculatorRef = useRef<HTMLElement>(null);
  const shouldFocusCalculator = useRef(false);
  const { calculator: state, history, loaded: isReady } = session;
  const display = getDisplay(state);

  // 読込前は入力と保存を止め、空の初期履歴で保存内容を上書きしない。
  useEffect(() => {
    let saved = [] as typeof history;
    try {
      saved = parseHistory(localStorage.getItem(HISTORY_STORAGE_KEY));
      storageReadable.current = true;
    } catch {
      setStorageStatus("履歴を読み込めません。この画面内のみ保持します");
    }
    lastSaved.current = serializeHistory(saved);
    dispatch({ type: "load", history: saved });
  }, []);

  useEffect(() => {
    if (!isReady || !storageReadable.current) return;
    const serialized = serializeHistory(history);
    if (serialized === lastSaved.current) return;
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, serialized);
      lastSaved.current = serialized;
      setStorageStatus(null);
    } catch {
      setStorageStatus("履歴を保存できません。この画面内のみ保持します");
    }
  }, [history, isReady]);

  const cancelPasteRead = useCallback(() => {
    pasteRequest.current += 1;
    setIsReadingPaste(false);
  }, []);

  useEffect(
    () => () => {
      pasteRequest.current += 1;
    },
    [],
  );

  const press = useCallback(
    (key: CalculatorKey) => {
      cancelPasteRead();
      dispatch({ type: "press", key, id: crypto.randomUUID() });
      setCopyStatus("idle");
    },
    [cancelPasteRead],
  );

  const pasteText = useCallback(
    (text: string): string | null => {
      const parsed = parsePastedNumber(text);
      cancelPasteRead();
      if (parsed.value !== null) {
        shouldFocusCalculator.current = true;
        setManualPasteOpen(false);
      }
      dispatch({ type: "paste", text });
      setCopyStatus("idle");
      return parsed.notice;
    },
    [cancelPasteRead],
  );

  async function handlePaste() {
    const request = ++pasteRequest.current;
    setIsReadingPaste(true);
    try {
      // ユーザーのボタン操作時だけ読む。通常のCmd/Ctrl+Vはpasteイベントを使う。
      const text = await navigator.clipboard.readText();
      if (request !== pasteRequest.current) return;
      pasteText(text);
    } catch {
      if (request === pasteRequest.current) setManualPasteOpen(true);
    } finally {
      if (request === pasteRequest.current) setIsReadingPaste(false);
    }
  }

  function changePanel(next: "calculator" | "history") {
    cancelPasteRead();
    setPanel(next);
  }

  function closeManualPaste() {
    cancelPasteRead();
    setManualPasteOpen(false);
    calculatorRef.current?.focus();
  }

  function restoreHistory(id: string, mode: "edit" | "continue") {
    cancelPasteRead();
    shouldFocusCalculator.current = true;
    dispatch({ type: "restore", id, mode });
    setCopyStatus("idle");
    setPanel("calculator");
  }

  // hidden 解除後、次のキー入力より前にフォーカスを戻す。
  useLayoutEffect(() => {
    if (shouldFocusCalculator.current) {
      shouldFocusCalculator.current = false;
      calculatorRef.current?.focus();
    }
  }, [state, panel]);

  useEffect(() => {
    const element = calculatorRef.current;

    if (element === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, [contenteditable], [data-calculator-paste]")
      )
        return;
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
    cancelPasteRead();
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
    <div className="mx-auto flex h-full min-h-0 max-w-[816px] flex-col gap-2">
      <h1 className="sr-only">電卓</h1>
      <div role="group" aria-label="表示切替" className="flex shrink-0 gap-2 md:hidden">
        <Button
          type="button"
          size="default"
          variant={panel === "calculator" ? "default" : "outline"}
          aria-pressed={panel === "calculator"}
          aria-controls="calculator-panel"
          onClick={() => changePanel("calculator")}
        >
          電卓
        </Button>
        <Button
          type="button"
          size="default"
          variant={panel === "history" ? "default" : "outline"}
          aria-pressed={panel === "history"}
          aria-controls="calculator-history-panel"
          onClick={() => changePanel("history")}
        >
          履歴 {history.length}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <section
          id="calculator-panel"
          ref={calculatorRef}
          aria-label="電卓"
          tabIndex={-1}
          onPaste={(event) => {
            if (!isReady || event.defaultPrevented) return;
            if (
              event.target instanceof HTMLElement &&
              event.target.closest("input, textarea, [contenteditable], [data-calculator-paste]")
            )
              return;
            event.preventDefault();
            try {
              pasteText(event.clipboardData.getData("text/plain"));
            } catch {
              cancelPasteRead();
              setManualPasteOpen(true);
            }
          }}
          className={cn(
            "group/calculator h-full max-h-[540px] min-h-0 min-w-0 w-full self-start flex-col rounded-xl border border-border bg-card p-3.5 transition-colors outline-none focus-within:border-ring md:flex md:rounded-2xl md:p-[17px] [@media(max-height:640px)]:p-2.5",
            panel === "calculator" ? "flex" : "hidden",
          )}
        >
          <CalculatorDisplay
            display={display}
            copyStatus={copyStatus}
            canCopy={isReady && display.copyText !== null}
            onCopy={handleCopy}
            canPaste={isReady && !isReadingPaste}
            onPaste={handlePaste}
          />

          <NumberPasteDialog
            open={manualPasteOpen}
            onClose={closeManualPaste}
            onPaste={pasteText}
          />

          <Keypad isReady={isReady} onPress={press} />

          <div
            className={cn(
              "mx-[3px] mt-[13px] flex shrink-0 items-center justify-between gap-3 text-[0.625rem] text-muted-foreground [@media(max-height:640px)]:mt-2",
              state.notice === null && "[@media(max-height:520px)]:hidden",
            )}
          >
            <p role="status" className="m-0">
              {state.notice ?? "四則演算"}
            </p>
            <KeyboardIndicator />
          </div>
        </section>

        <section
          id="calculator-history-panel"
          aria-label="計算履歴"
          aria-busy={!isReady}
          className={cn(
            "min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card p-3.5 md:flex md:h-full md:max-h-[540px] md:self-start md:rounded-2xl md:p-[17px]",
            panel === "history" ? "flex" : "hidden",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="m-0 text-sm font-semibold">
              履歴{" "}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {history.length} / {HISTORY_LIMIT}
              </span>
            </h2>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!isReady || history.length === 0}
              onClick={() => {
                cancelPasteRead();
                if (window.confirm("計算履歴をすべて削除しますか？")) {
                  dispatch({ type: "clear-history" });
                }
              }}
            >
              全削除
            </Button>
          </div>
          {storageStatus && (
            <p role="status" className="mt-2 text-xs text-destructive">
              {storageStatus}
            </p>
          )}
          {isReady && history.length === 0 && (
            <p className="my-3 text-center text-xs text-muted-foreground">履歴はありません</p>
          )}
          <ol
            aria-label="計算履歴一覧"
            tabIndex={0}
            className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {history.map(({ id, calculation }) => {
              const saved = getDisplay(calculation);
              return (
                <li key={id} className="border-t border-border py-3 first:border-t-0">
                  <p className="m-0 text-xs text-muted-foreground tabular-nums wrap-anywhere">
                    {saved.expression}
                  </p>
                  <p className="mt-1 mb-2 text-right text-lg font-medium text-primary tabular-nums wrap-anywhere">
                    {saved.result}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => restoreHistory(id, "edit")}
                    >
                      式を直す
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={saved.isError}
                      onClick={() => restoreHistory(id, "continue")}
                    >
                      結果から続ける
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="ml-auto min-h-11"
                      aria-label={`${saved.expression} ${saved.result} の履歴を削除`}
                      onClick={() => {
                        cancelPasteRead();
                        dispatch({ type: "delete", id });
                      }}
                    >
                      削除
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
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
  canPaste,
  onPaste,
}: {
  display: Display;
  copyStatus: CopyStatus;
  canCopy: boolean;
  onCopy: () => void;
  canPaste: boolean;
  onPaste: () => void;
}) {
  return (
    <div className="flex min-h-[128px] min-w-0 flex-[1_1_150px] flex-col rounded-[11px] border border-[#e9dcf8] bg-[#f3ecfc] px-[19px] pt-[15px] pb-[17px] text-right md:px-[21px] md:pt-[17px] md:pb-[19px] [@media(max-height:640px)]:min-h-[112px] [@media(max-height:640px)]:flex-[1_0_112px] [@media(max-height:640px)]:p-2 [@media(max-height:520px)]:min-h-[96px] [@media(max-height:520px)]:flex-[1_0_96px]">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2.5 [@media(max-height:640px)]:mb-1">
        <span role="status" className="min-w-0 text-[0.625rem] text-muted-foreground">
          {copyStatus === "copied" ? "コピーしました" : null}
          {copyStatus === "failed" ? "コピーできませんでした" : null}
          {copyStatus === "idle" ? (
            <span aria-hidden="true" className="text-[0.9375rem] leading-none text-[#c1a6d9]">
              ✧
            </span>
          ) : null}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="bg-card"
            disabled={!canPaste}
            onClick={onPaste}
          >
            貼り付け
          </Button>
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
        tabIndex={display.expression === "" ? -1 : 0}
        aria-label="計算式"
        className="m-0 min-h-0 flex-1 overflow-y-auto text-[0.8125rem] leading-[1.6] tracking-[0.6px] text-muted-foreground tabular-nums wrap-anywhere outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {display.expression === "" ? null : <span className="sr-only">計算式 </span>}
        {display.expression}
      </p>

      <output
        aria-label="計算結果"
        className={cn(
          "mt-[3px] block shrink-0 font-medium tracking-[-1.5px] tabular-nums wrap-anywhere",
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
      className="mt-[13px] grid min-h-0 flex-[0_1_282px] grid-cols-4 grid-rows-5 gap-2 md:mt-[15px] md:basis-[281px] md:gap-[9px] [@media(max-height:640px)]:mt-3 [@media(max-height:640px)]:basis-[244px] [@media(max-height:640px)]:gap-1.5"
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
  if (result.length <= 9)
    return "text-[clamp(1rem,5dvh,3rem)] md:text-[clamp(1rem,5dvh,3.1875rem)]";
  if (result.length <= 11) return "text-4xl";
  if (result.length <= 14) return "text-[1.75rem]";
  if (result.length <= 20) return "text-xl";

  return "text-base";
}

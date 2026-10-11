"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  MAX_LENGTH,
  MIN_LENGTH,
  generateCharacters,
  parseLength,
  type CharacterType,
} from "../lib/generate-characters";

type CopyStatus = "idle" | "copied" | "failed";

const INITIAL_LENGTH = "10";
const LENGTH_ERROR_MESSAGE = `文字数は${MIN_LENGTH}〜${MAX_LENGTH}の整数で入力してください`;

const CHARACTER_TYPE_OPTIONS: { value: CharacterType; label: string }[] = [
  { value: "hiragana", label: "ひらがな" },
  { value: "alphanumeric", label: "英数字" },
];

const FIELD_LABEL_CLASS = "mb-2 block text-xs text-muted-foreground";

const FIELD_FOCUS_CLASS =
  "outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function CharacterGenerator() {
  const [isReady, setIsReady] = useState(false);
  const [lengthInput, setLengthInput] = useState(INITIAL_LENGTH);
  const [characterType, setCharacterType] = useState<CharacterType>("hiragana");
  const [hasLengthError, setHasLengthError] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  // ハイドレーション前の入力・送信は React の状態に反映されないため受け付けない。
  useEffect(() => setIsReady(true), []);

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCopyStatus("idle");

    const length = parseLength(lengthInput);

    if (length === null) {
      setHasLengthError(true);
      setGenerated(null);
      return;
    }

    setHasLengthError(false);
    setGenerated(generateCharacters(characterType, length));
  }

  async function handleCopy() {
    if (generated === null) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generated);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="m-0 text-[1.625rem] font-semibold tracking-tight">
        Character Generator
        <span aria-hidden="true" className="ml-3 text-primary/60">
          ✳
        </span>
      </h1>
      <p className="mt-2 mb-0 text-sm leading-7 text-muted-foreground">
        必要な長さのテキストを、さっと用意。
      </p>

      <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <SettingsCard
          isReady={isReady}
          lengthInput={lengthInput}
          onLengthChange={(value) => {
            setLengthInput(value);
            setHasLengthError(false);
          }}
          characterType={characterType}
          onCharacterTypeChange={setCharacterType}
          hasLengthError={hasLengthError}
          onSubmit={handleGenerate}
        />

        <ResultPanel generated={generated} copyStatus={copyStatus} onCopy={handleCopy} />
      </div>
    </div>
  );
}

function SettingsCard({
  isReady,
  lengthInput,
  onLengthChange,
  characterType,
  onCharacterTypeChange,
  hasLengthError,
  onSubmit,
}: {
  isReady: boolean;
  lengthInput: string;
  onLengthChange: (value: string) => void;
  characterType: CharacterType;
  onCharacterTypeChange: (value: CharacterType) => void;
  hasLengthError: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const headingId = useId();
  const lengthId = useId();
  const lengthMessageId = useId();
  const typeId = useId();

  return (
    <form
      noValidate
      aria-labelledby={headingId}
      onSubmit={onSubmit}
      className="min-w-0 rounded-xl border border-border bg-accent p-5 shadow-[0_3px_0_var(--border)]"
    >
      <h2 id={headingId} className="m-0 mb-5 text-xs font-semibold text-muted-foreground">
        生成する長さ
      </h2>

      <label htmlFor={lengthId} className={FIELD_LABEL_CLASS}>
        文字数
      </label>
      <div className="relative flex items-center">
        <input
          id={lengthId}
          type="number"
          inputMode="numeric"
          min={MIN_LENGTH}
          max={MAX_LENGTH}
          step={1}
          value={lengthInput}
          disabled={!isReady}
          autoComplete="off"
          aria-invalid={hasLengthError || undefined}
          aria-describedby={lengthMessageId}
          onChange={(event) => onLengthChange(event.target.value)}
          className={`h-14 w-full min-w-0 [appearance:textfield] rounded-lg border border-input bg-card py-2 pr-12 pl-4 text-2xl font-medium text-primary aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${FIELD_FOCUS_CLASS}`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 text-xs text-muted-foreground"
        >
          文字
        </span>
      </div>
      <LengthMessage id={lengthMessageId} hasError={hasLengthError} />

      <div className="my-5">
        <label htmlFor={typeId} className={FIELD_LABEL_CLASS}>
          文字の種類
        </label>
        <select
          id={typeId}
          value={characterType}
          disabled={!isReady}
          onChange={(event) => {
            const option = CHARACTER_TYPE_OPTIONS.find(
              (candidate) => candidate.value === event.target.value,
            );

            if (option) {
              onCharacterTypeChange(option.value);
            }
          }}
          className={`h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm ${FIELD_FOCUS_CLASS}`}
        >
          {CHARACTER_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={!isReady}>
        <span aria-hidden="true">✧</span>
        生成する
      </Button>
    </form>
  );
}

function LengthMessage({ id, hasError }: { id: string; hasError: boolean }) {
  if (hasError) {
    return (
      <p id={id} role="alert" className="mt-2 mb-0 text-xs leading-5 font-medium text-destructive">
        {LENGTH_ERROR_MESSAGE}
      </p>
    );
  }

  return (
    <p id={id} className="mt-2 mb-0 text-xs leading-5 text-muted-foreground">
      {MIN_LENGTH}〜{MAX_LENGTH}の整数
    </p>
  );
}

function ResultPanel({
  generated,
  copyStatus,
  onCopy,
}: {
  generated: string | null;
  copyStatus: CopyStatus;
  onCopy: () => void;
}) {
  const resultId = useId();

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_3px_0_var(--border)]">
      <div className="flex h-11 items-center justify-between gap-3 border-b border-border px-4 text-xs font-semibold">
        <label htmlFor={resultId}>生成結果</label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={generated === null}
          onClick={onCopy}
        >
          コピー
        </Button>
      </div>

      <Textarea
        id={resultId}
        readOnly
        value={generated ?? ""}
        spellCheck={false}
        className="h-60 field-sizing-fixed resize-none rounded-none border-0 bg-transparent p-4 text-base leading-7 whitespace-pre-wrap wrap-anywhere focus-visible:ring-inset md:h-64 dark:bg-transparent"
      />

      <div className="flex min-h-10 items-center justify-between gap-3 border-t border-border bg-muted px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        <p role="status" className="m-0">
          {generated === null
            ? "「生成する」を押すと、ここに結果が表示されます"
            : `${generated.length} 文字を生成しました`}
        </p>
        <p role="status" className="m-0">
          {copyStatus === "copied" ? "コピーしました" : null}
          {copyStatus === "failed" ? "コピーできませんでした" : null}
        </p>
      </div>
    </section>
  );
}

"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function NumberPasteDialog({
  open,
  onClose,
  onPaste,
}: {
  open: boolean;
  onClose: () => void;
  onPaste: (text: string) => string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) {
      setText("");
      setError(null);
      dialog?.showModal();
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      data-calculator-paste
      aria-labelledby="number-paste-title"
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-80 max-w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-4 text-foreground shadow-lg backdrop:bg-black/20"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError(onPaste(text));
        }}
      >
        <label id="number-paste-title" htmlFor="number-paste-input" className="text-sm font-medium">
          数値を貼り付け
        </label>
        <p className="mt-1 mb-3 text-xs text-muted-foreground">ここに貼り付けて入力してください</p>
        <input
          id="number-paste-input"
          type="text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          placeholder="1,234.5"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={error ? "number-paste-error" : undefined}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error && (
          <p id="number-paste-error" role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            閉じる
          </Button>
          <Button type="submit" className="min-h-11">
            入力
          </Button>
        </div>
      </form>
    </dialog>
  );
}

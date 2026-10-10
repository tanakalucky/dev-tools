"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatJsonEncoded, minifyJsonEncoded, type JsonFailure, type EncodedResult } from "../lib";
import { MAX_INPUT_BYTES } from "../lib/size-limit";

type CopyStatus = "idle" | "copied" | "failed";

// 部品の既定 (field-sizing-content) は 1 MiB の入力で欄が際限なく伸びるため、固定サイズにする。
const codeAreaClassName =
  "field-sizing-fixed min-h-48 resize-y font-mono text-sm leading-[1.45] [tab-size:2]";
// タッチターゲットの最小高さを保ち、狭い画面では 2 列に折り返す。
const actionButtonClassName = "h-auto min-h-11 px-3.5 py-2 max-[30rem]:flex-[1_1_calc(50%-0.5rem)]";
const messageClassName = "border-l-[0.375rem] wrap-anywhere";
const descriptionClassName = "grid gap-1 [&_p:not(:last-child)]:mb-0";

// JSX の行またぎテキストは空白 1 つで連結されるため、単一の文字列として保持する。
const DECODE_NOTICE_TEXT =
  "JSON 文字列エンコードを 1 階層デコードしました。行番号と列番号は元の入力ではなく、デコード後のテキストを指します。";

function failureTitle(failure: JsonFailure): string {
  switch (failure.kind) {
    case "too-large":
      return "入力が大きすぎます";
    case "too-deep":
      return "入力のネストが深すぎます";
    case "output-too-large":
      return "整形後の出力が大きくなりすぎます";
    case "syntax":
      return "JSON が正しくありません";
  }
}

function failureLocation(failure: JsonFailure): string | null {
  if (failure.kind === "syntax" || failure.kind === "too-deep") {
    return `${failure.line} 行目、${failure.column} 列目`;
  }
  return null;
}

function subscribeToNothing() {
  return () => {};
}

function isClient() {
  return true;
}

function isServer() {
  return false;
}

export function JsonTool() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<EncodedResult | null>(null);
  const [decodeEncoded, setDecodeEncoded] = useState(true);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  // 出力が変わるたび、およびコピーを試みるたびに増やす。これにより、遅れて完了した
  // クリップボード書き込みが、古い出力や同じ出力への新しい試行の結果を上書きしない。
  const copySequence = useRef(0);
  // サーバーレンダリング中とハイドレーション中は false、クライアントに切り替わると true。
  const hydrated = useSyncExternalStore(subscribeToNothing, isClient, isServer);

  const output = result?.ok === true ? result.output : "";
  const warnings = result?.ok === true ? result.warnings : [];
  const failure = result !== null && !result.ok ? result : null;
  const hasInput = input.length > 0;
  const hasOutput = result?.ok === true;

  function invalidate(next: EncodedResult | null) {
    copySequence.current += 1;
    setResult(next);
    setCopyStatus("idle");
  }

  function handleDecodeToggle(checked: boolean) {
    setDecodeEncoded(checked);
    invalidate(null);
  }

  function handleInputChange(value: string) {
    setInput(value);
    invalidate(null);
  }

  function handleClear() {
    setInput("");
    invalidate(null);
  }

  async function handleCopy() {
    if (result?.ok !== true) {
      return;
    }
    copySequence.current += 1;
    const attempt = copySequence.current;
    // 新しい試行は、自身が完了するまで前の試行の状態を置き換える。
    setCopyStatus("idle");
    let status: CopyStatus = "failed";
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText !== undefined) {
        await navigator.clipboard.writeText(result.output);
        status = "copied";
      }
    } catch {
      status = "failed";
    }
    if (copySequence.current === attempt) {
      setCopyStatus(status);
    }
  }

  const location = failure === null ? null : failureLocation(failure);

  return (
    <div className="json-tool mt-6 grid gap-4" data-hydrated={hydrated ? "true" : "false"}>
      <div className="grid gap-1.5">
        <Label htmlFor="json-input" className="font-semibold">
          入力 JSON
        </Label>
        <Textarea
          id="json-input"
          className={codeAreaClassName}
          value={input}
          onChange={(event) => handleInputChange(event.target.value)}
          aria-describedby="json-input-hint"
          aria-invalid={failure !== null}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={12}
        />
        <p id="json-input-hint" className="m-0 text-sm text-muted-foreground">
          最大 {MAX_INPUT_BYTES.toLocaleString("en-US")} バイト (1 MiB、UTF-8)。処理はこの
          ブラウザタブ内だけで行われます。入力は変更されません。
        </p>
      </div>

      <div className="grid gap-1.5">
        {/* Base UI の Checkbox は role="checkbox" の span と、隠し input を描画する。
            名前は aria-labelledby で文言の要素に明示的に結び付ける。 */}
        <Label className="items-start font-semibold leading-normal">
          <Checkbox
            checked={decodeEncoded}
            onCheckedChange={(checked) => handleDecodeToggle(checked)}
            aria-labelledby="json-decode-label"
            className="mt-1"
          />
          <span id="json-decode-label">
            オブジェクトまたは配列を含む JSON 文字列をデコードする (1 階層)
          </span>
        </Label>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="JSON の操作">
        <Button
          type="button"
          variant="outline"
          className={actionButtonClassName}
          onClick={() => invalidate(formatJsonEncoded(input, { decodeEncoded }))}
          disabled={!hasInput}
        >
          整形 (2 スペース)
        </Button>
        <Button
          type="button"
          variant="outline"
          className={actionButtonClassName}
          onClick={() => invalidate(minifyJsonEncoded(input, { decodeEncoded }))}
          disabled={!hasInput}
        >
          最小化
        </Button>
        <Button
          type="button"
          variant="outline"
          className={actionButtonClassName}
          onClick={() => void handleCopy()}
          disabled={!hasOutput}
        >
          出力をコピー
        </Button>
        <Button
          type="button"
          variant="outline"
          className={actionButtonClassName}
          onClick={handleClear}
          disabled={!hasInput}
        >
          クリア
        </Button>
      </div>

      <p className="m-0 min-h-6 text-sm" role="status" aria-live="polite">
        {copyStatus === "copied" ? "出力をクリップボードにコピーしました。" : ""}
        {copyStatus === "idle" && result?.ok === true
          ? result.mode === "pretty"
            ? "2 スペースで整形しました。"
            : "最小化しました。"
          : ""}
      </p>

      {result?.decoded === true && result.ok ? (
        <Alert role="status" className={messageClassName}>
          <AlertDescription>{DECODE_NOTICE_TEXT}</AlertDescription>
        </Alert>
      ) : null}

      {copyStatus === "failed" ? (
        <Alert variant="destructive" className={messageClassName}>
          <AlertDescription className={descriptionClassName}>
            コピーできませんでした: クリップボードが利用できないか、ブラウザに拒否されました。
            出力を選択して手動でコピーしてください。
          </AlertDescription>
        </Alert>
      ) : null}

      {failure !== null ? (
        <Alert variant="destructive" className={messageClassName}>
          <AlertTitle>
            {failureTitle(failure)}
            {location !== null ? <span> ({location})</span> : null}
          </AlertTitle>
          <AlertDescription className={descriptionClassName}>
            <p>{failure.message}</p>
            {result?.decoded === true ? <p>{DECODE_NOTICE_TEXT}</p> : null}
            <p>入力は変更されていません。</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {warnings.length > 0 ? (
        <Alert role="status" className={`${messageClassName} border-[#b26a00]`}>
          <AlertTitle>
            {warnings.length === 1
              ? "重複キーの警告が 1 件あります"
              : `重複キーの警告が ${warnings.length} 件あります`}
          </AlertTitle>
          <AlertDescription className={descriptionClassName}>
            <p>すべてのキーは元の順序のまま出力に残ります。</p>
            <ul className="mt-2 list-disc pl-5">
              {warnings.map((warning) => (
                <li key={warning.offset}>
                  {warning.line} 行目、{warning.column} 列目
                  {result?.decoded === true ? " (デコード後のテキスト)" : ""}: {warning.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="json-output" className="font-semibold">
          出力 (読み取り専用)
        </Label>
        <Textarea
          id="json-output"
          className={codeAreaClassName}
          value={output}
          readOnly
          spellCheck={false}
          rows={12}
        />
      </div>
    </div>
  );
}

"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { formatJsonEncoded, minifyJsonEncoded, type JsonFailure, type EncodedResult } from "../lib";
import { MAX_INPUT_BYTES } from "../lib/size-limit";

type CopyStatus = "idle" | "copied" | "failed";

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
    <div className="json-tool" data-hydrated={hydrated ? "true" : "false"}>
      <div className="field">
        <label htmlFor="json-input">入力 JSON</label>
        <textarea
          id="json-input"
          className="code-area"
          value={input}
          onChange={(event) => handleInputChange(event.target.value)}
          aria-describedby="json-input-hint"
          aria-invalid={failure !== null}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={12}
        />
        <p id="json-input-hint" className="hint">
          最大 {MAX_INPUT_BYTES.toLocaleString("en-US")} バイト (1 MiB、UTF-8)。処理はこの
          ブラウザタブ内だけで行われます。入力は変更されません。
        </p>
      </div>

      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={decodeEncoded}
            onChange={(event) => handleDecodeToggle(event.target.checked)}
          />{" "}
          オブジェクトまたは配列を含む JSON 文字列をデコードする (1 階層)
        </label>
      </div>

      <div className="actions" role="group" aria-label="JSON の操作">
        <button
          type="button"
          onClick={() => invalidate(formatJsonEncoded(input, { decodeEncoded }))}
          disabled={!hasInput}
        >
          整形 (2 スペース)
        </button>
        <button
          type="button"
          onClick={() => invalidate(minifyJsonEncoded(input, { decodeEncoded }))}
          disabled={!hasInput}
        >
          最小化
        </button>
        <button type="button" onClick={() => void handleCopy()} disabled={!hasOutput}>
          出力をコピー
        </button>
        <button type="button" onClick={handleClear} disabled={!hasInput}>
          クリア
        </button>
      </div>

      <p className="status" role="status" aria-live="polite">
        {copyStatus === "copied" ? "出力をクリップボードにコピーしました。" : ""}
        {copyStatus === "idle" && result?.ok === true
          ? result.mode === "pretty"
            ? "2 スペースで整形しました。"
            : "最小化しました。"
          : ""}
      </p>

      {result?.decoded === true && result.ok ? (
        <p className="message" role="status">
          {DECODE_NOTICE_TEXT}
        </p>
      ) : null}

      {copyStatus === "failed" ? (
        <p className="message message-error" role="alert">
          コピーできませんでした: クリップボードが利用できないか、ブラウザに拒否されました。
          出力を選択して手動でコピーしてください。
        </p>
      ) : null}

      {failure !== null ? (
        <div className="message message-error" role="alert">
          <strong>{failureTitle(failure)}</strong>
          {location !== null ? <span> ({location})</span> : null}
          <p>{failure.message}</p>
          {result?.decoded === true ? <p>{DECODE_NOTICE_TEXT}</p> : null}
          <p>入力は変更されていません。</p>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="message message-warning" role="status">
          <strong>
            {warnings.length === 1
              ? "重複キーの警告が 1 件あります"
              : `重複キーの警告が ${warnings.length} 件あります`}
          </strong>
          <p>すべてのキーは元の順序のまま出力に残ります。</p>
          <ul>
            {warnings.map((warning) => (
              <li key={warning.offset}>
                {warning.line} 行目、{warning.column} 列目
                {result?.decoded === true ? " (デコード後のテキスト)" : ""}: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="json-output">出力 (読み取り専用)</label>
        <textarea
          id="json-output"
          className="code-area"
          value={output}
          readOnly
          spellCheck={false}
          rows={12}
        />
      </div>
    </div>
  );
}

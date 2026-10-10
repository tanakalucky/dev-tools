"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { formatJson, minifyJson, type JsonFailure, type JsonResult } from "../../lib/json";
import { MAX_INPUT_BYTES } from "../../lib/size-limit";

type CopyStatus = "idle" | "copied" | "failed";

function failureTitle(failure: JsonFailure): string {
  switch (failure.kind) {
    case "too-large":
      return "Input is too large";
    case "too-deep":
      return "Input is nested too deeply";
    case "output-too-large":
      return "Formatted output would be too large";
    case "syntax":
      return "Invalid JSON";
  }
}

function failureLocation(failure: JsonFailure): string | null {
  if (failure.kind === "syntax" || failure.kind === "too-deep") {
    return `Line ${failure.line}, column ${failure.column}`;
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
  const [result, setResult] = useState<JsonResult | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  // Bumped whenever the output changes and for every copy attempt, so a slow clipboard write can
  // report neither on stale output nor over a newer attempt on the same output.
  const copySequence = useRef(0);
  // False in the server render and during hydration, true once the client has taken over.
  const hydrated = useSyncExternalStore(subscribeToNothing, isClient, isServer);

  const output = result?.ok === true ? result.output : "";
  const warnings = result?.ok === true ? result.warnings : [];
  const failure = result !== null && !result.ok ? result : null;
  const hasInput = input.length > 0;
  const hasOutput = result?.ok === true;

  function invalidate(next: JsonResult | null) {
    copySequence.current += 1;
    setResult(next);
    setCopyStatus("idle");
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
    // A new attempt supersedes the previous one's status until it settles itself.
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
        <label htmlFor="json-input">Input JSON</label>
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
          Up to {MAX_INPUT_BYTES.toLocaleString("en-US")} bytes (1 MiB, UTF-8). Processed in this
          browser tab only. Your input is never changed.
        </p>
      </div>

      <div className="actions" role="group" aria-label="JSON actions">
        <button type="button" onClick={() => invalidate(formatJson(input))} disabled={!hasInput}>
          Format (2 spaces)
        </button>
        <button type="button" onClick={() => invalidate(minifyJson(input))} disabled={!hasInput}>
          Minify
        </button>
        <button type="button" onClick={() => void handleCopy()} disabled={!hasOutput}>
          Copy output
        </button>
        <button type="button" onClick={handleClear} disabled={!hasInput}>
          Clear
        </button>
      </div>

      <p className="status" role="status" aria-live="polite">
        {copyStatus === "copied" ? "Output copied to the clipboard." : ""}
        {copyStatus === "idle" && result?.ok === true
          ? result.mode === "pretty"
            ? "Formatted with 2 spaces."
            : "Minified."
          : ""}
      </p>

      {copyStatus === "failed" ? (
        <p className="message message-error" role="alert">
          Could not copy: the clipboard is unavailable or the browser refused. Select the output and
          copy it manually.
        </p>
      ) : null}

      {failure !== null ? (
        <div className="message message-error" role="alert">
          <strong>{failureTitle(failure)}</strong>
          {location !== null ? <span> ({location})</span> : null}
          <p>{failure.message}</p>
          <p>Your input was left unchanged.</p>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="message message-warning" role="status">
          <strong>
            {warnings.length === 1
              ? "1 duplicate key warning"
              : `${warnings.length} duplicate key warnings`}
          </strong>
          <p>All keys are kept in the output, in their original order.</p>
          <ul>
            {warnings.map((warning) => (
              <li key={warning.offset}>
                Line {warning.line}, column {warning.column}: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="json-output">Output (read-only)</label>
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

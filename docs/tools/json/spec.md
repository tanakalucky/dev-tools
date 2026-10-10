# JSON formatter spec

Status: implemented in code, **not yet accepted**. See [Still pending](#still-pending). Review rounds consumed: 1 of 3 (historical round 1, adopted into the plugin review ledger as historical_unverified); its P1 findings remain unresolved pending independent review round 2, which has not started.

## Route

- Home / tool list: `/` (`app/page.tsx`)
- JSON tool: `/json` (`app/json/page.tsx`, client component `features/json/components/json-tool.tsx`)

## Pure API

Public entry point: `features/json/lib/index.ts`. No DOM, no network, no storage. None of these functions throw on bad input; they return a result object.

| Function               | Success result                                           |
| ---------------------- | -------------------------------------------------------- |
| `formatJson(source)`   | `{ ok: true, mode: "pretty", output, source, warnings }` |
| `minifyJson(source)`   | `{ ok: true, mode: "minify", output, source, warnings }` |
| `validateJson(source)` | `{ ok: true, source, warnings }`                         |

Every result, success or failure, carries the original `source` unchanged.

Failure results are `{ ok: false, kind, message, source, ... }` with one of these kinds:

| Kind               | Extra fields                        | Meaning                                         |
| ------------------ | ----------------------------------- | ----------------------------------------------- |
| `too-large`        | `bytes`, `limit`                    | Input is over the input cap. Nothing is parsed. |
| `syntax`           | `offset`, `line`, `column`          | Not a single valid JSON document.               |
| `too-deep`         | `offset`, `line`, `column`, `limit` | Nesting is over the nesting cap.                |
| `output-too-large` | `limit`                             | Pretty output would exceed the output bound.    |

Also exported: the constants `MAX_DEPTH` and `MAX_OUTPUT_LENGTH`, and the result types. The input cap constant `MAX_INPUT_BYTES` lives in `features/json/lib/size-limit.ts`.

Processing order: size check, tokenize, grammar check, duplicate-key scan, then printing.

## Preservation

The printers copy every token verbatim from the input and only produce the whitespace between tokens. The document is never round-tripped through `JSON.parse` / `JSON.stringify`. As a result:

- Number spelling is preserved (`1.0`, `1e5`, `-0`, large integers and long decimals are not rewritten).
- Raw string escapes are preserved (unicode escapes, `\/` and `\n` stay exactly as written).
- Key order is preserved.
- Duplicate keys are preserved; none are removed, merged or renamed.
- Whitespace inside strings is preserved. Only insignificant whitespace between tokens changes.

Format indents with 2 spaces. Empty containers print as `[]` and `{}`. Minify removes insignificant whitespace only.

Whitespace between tokens is exactly space, tab, `\n` and `\r`. Any other character there (for example a no-break space) is a syntax error.

## Top-level primitives

Any single JSON value is accepted at the top level: object, array, string, number, `true`, `false`, `null`. Empty or whitespace-only input is a syntax error (`Empty input: expected a JSON value`).

### Strings stay strings

A valid JSON string is formatted as that same string (`"hello"`, `"123"`, `"true"` stay strings). The only exception is an encoded container, below. Backslashes are never removed otherwise.

## Encoded JSON containers

Exported: `formatJsonEncoded`, `minifyJsonEncoded`, `validateJsonEncoded`, `decodeEncodedContainer`, `MAX_WRAPPER_LAYERS` (= 1), in `features/json/lib/encoded.ts`. Existing `formatJson`, `minifyJson`, `validateJson` are unchanged.

- Detection: after trimming JSON whitespace, the whole input is exactly one valid JSON string token, and the decoded text, after trimming JSON whitespace, begins with `{` or `[`. Example: `"{\"a\":1}"` formats as `{ "a": 1 }`. Only the outer string token is passed to `JSON.parse`; the inner text goes through the normal token-preserving path, so large numbers, key order, duplicate keys and inner escapes are preserved.
- Exactly one layer is removed. A double-encoded string, a normal string, or a scalar is not decoded and behaves as before.
- Limits: the 1 MiB input check applies to the original input and to the decoded text; the depth and output caps apply to the decoded text.
- Results carry `decoded: true, layers: 1` (or `decoded: false`). When decoded, failures and duplicate-key warnings use line/column of the **decoded text**, not the original input, and `source` is the decoded text. A malformed decoded container is a failure; there is no fallback and no partial output.
- Option `{ decodeEncoded: false }` disables decoding. The UI has a checkbox, checked by default, "Decode a JSON string that contains an object or array (1 layer)"; toggling it clears output, notices, errors and copy status. On success the UI shows "Decoded 1 layer of JSON string encoding. Line and column numbers refer to the decoded text, not your original input." The input textarea is never modified.
- **Unsupported**: raw shell quoting, prompts or prefixes, arbitrary backslash or escape removal, double-encoded or deeper layers, encoded scalars, and any unknown terminal format. Not all terminal pastes are handled; no exact terminal sample was provided.

## Syntax diagnostics

A `syntax` or `too-deep` failure reports the UTF-16 `offset` plus `line` and `column`. When both a grammar problem and a later lexical error exist, the one that comes first in the text is reported.

### Line and column convention

Defined in `features/json/lib/position.ts`:

- Lines and columns are **1-based**.
- Columns count UTF-16 code units, so a character outside the Basic Multilingual Plane (one surrogate pair) advances the column by two. A tab counts as one column.
- Line breaks are `\n`, `\r\n` and a lone `\r`. A CRLF pair counts as **one** line break.

## Duplicate-key warnings

Duplicate keys are valid JSON here: they produce warnings, never failures, and the output keeps every key.

- Scope is a single object. The same key in two different objects, or in a parent and a child, is not a duplicate.
- Keys are compared by their **decoded** value, so a key written literally as `"a"` and a key written with the unicode escape for the same letter are duplicates even though they are spelled differently.
- The first occurrence is not warned about. Each later occurrence produces one warning carrying `key` (decoded), `rawKey` (as written, with quotes), its own `offset` / `line` / `column`, and `firstOffset` / `firstLine` / `firstColumn` pointing at the first occurrence.
- Names such as `__proto__` and `constructor` are ordinary keys.

## Limits

| Limit        | Value                         | Constant            | Defined in                          | Boundary                           |
| ------------ | ----------------------------- | ------------------- | ----------------------------------- | ---------------------------------- |
| Input cap    | 1,048,576 UTF-8 bytes (1 MiB) | `MAX_INPUT_BYTES`   | `features/json/lib/size-limit.ts:2` | Exactly 1,048,576 bytes is allowed |
| Nesting cap  | 128 containers                | `MAX_DEPTH`         | `features/json/lib/types.ts:2`      | Depth 128 allowed, 129 rejected    |
| Output bound | 8,388,608 UTF-16 code units   | `MAX_OUTPUT_LENGTH` | `features/json/lib/types.ts:8`      | Exactly at the bound is allowed    |

- The input cap is measured in UTF-8 bytes, not characters, and is checked before any parsing.
- The nesting cap counts arrays and objects together.
- The output bound applies to pretty (format) output only, because indentation can make output larger than input. Minified output is never longer than its input, so it is covered by the input cap.

## Privacy

Input is processed in the browser tab. The tool makes no network request with the input, uses no `localStorage` or other persistence, sends no telemetry, and does not use `eval` or `dangerouslySetInnerHTML`. The only `JSON.parse` call in the core decodes a single, already-validated object key for duplicate detection; it never sees the whole document.

Copy writes the output to the system clipboard, only when the user presses the button.

## UI controls

The page has a labelled input textarea ("Input JSON") and a labelled read-only output textarea ("Output (read-only)").

| Control           | Behaviour                                                               | Disabled when      |
| ----------------- | ----------------------------------------------------------------------- | ------------------ |
| Format (2 spaces) | Runs `formatJson` on the input and shows the result in the output area. | Input is empty     |
| Minify            | Runs `minifyJson` on the input and shows the result in the output area. | Input is empty     |
| Copy output       | Writes the current output to the clipboard.                             | There is no output |
| Clear             | Empties the input, the output and all messages.                         | Input is empty     |

- Work runs on button press only. Nothing is parsed or formatted while typing.
- The input is never modified by Format or Minify, and is preserved on failure. Only Clear empties it.
- Editing the input discards the previous output, error, warnings and copy status, so the output area never shows a result for text that is no longer in the input.
- Failures appear in a `role="alert"` box with a title, the line and column when the core provides them (`syntax`, `too-deep`), and the core's message. The output area is empty after a failure.
- Over-cap input is not truncated or blocked while typing or pasting; pressing Format or Minify reports the `too-large` failure with the actual byte count and the limit.
- Duplicate-key warnings are listed with line and column below the controls; the output still contains every key.
- "Copied" is shown only after the clipboard write resolves. If the clipboard API is missing or the write is rejected, a visible `role="alert"` failure message is shown instead.
- Success and copy status use a `role="status"` live region. Controls are native buttons with a visible focus outline, and the layout wraps on narrow screens.

## Browser tests

`npm run test:e2e` runs the Playwright tests in `e2e/json.pw.ts` against `npm run dev` on `127.0.0.1:43173`, in Chromium only. Prerequisite: a Playwright Chromium build (`npx playwright install chromium`). The `.pw.ts` suffix keeps these files out of the vitest run.

The 13 tests use synthetic input only and cover:

- Home page link to `/json`, the accessible names of the fields and buttons, and keyboard-only use at a 360x640 viewport.
- Format with 2 spaces keeping `9007199254740993` exactly, with the input unchanged.
- Minify keeping raw escapes, and markup inside JSON strings staying inert text (no element created, no script run, no dialog).
- A syntax error with line and column and the input preserved; editing and Clear discarding stale output and errors.
- Duplicate-key warnings with both keys kept in the output.
- Copy against a **stubbed** `navigator.clipboard`: success shown only after the write resolves; a rejected write or a missing API shows the failure message and no success claim.
- Copy ordering with deferred clipboard stubs: two pending writes of one output settling in either order (the newest request owns the status), and an input edit, Clear, reformat or minify while a write is pending discarding that write's status.
- Hydration readiness: tests wait for `data-hydrated="true"` on the tool container, which reads the page only and never clears input, before typing and before the post-reload persistence assertions.
- Privacy: a sentinel typed after page load does not appear in any request, WebSocket frame, `localStorage`, `sessionStorage`, cookie or the URL, and is gone after reload.

Playwright discovers 17 cases (`npx playwright test --list`). Real browser evidence exists only for the earlier commit `16d94360e590265fc99db8ac7202ad558fbae32a` (GitHub Actions run 38021075480, job 114121976045): 133 unit tests, all gates, and 13 real Chromium E2E passes (17.1 s). The newly added E2E cases (including the escaped-input ones) have NOT been executed in a browser and await CI. Local browser/server execution is environment-blocked: the dev server cannot start (`uv_interface_addresses returned Unknown system error 1`, raised from `os.networkInterfaces()` inside `@cloudflare/vite-plugin`).

Separate and distinct: the build warns that `react-server-dom-webpack/static.edge` (and its `package.json`) cannot be resolved; plugin-rsc 0.5.36 marks it an optional peer. That warning is not the browser-startup error.

Last verified locally: 156 unit tests passing (`npm run test`); typecheck, lint, fmt:check and the production build pass. The Node minimum (22.12) is declared, not tested as a version matrix.

## Still pending

None of the following has been done. This spec makes no claim of a reviewed or deployed MVP.

- **Browser acceptance: STILL PENDING.** The UI behaviour above is described from the code. Browser tests exist (see [Browser tests](#browser-tests)); passing Chromium runs are recorded only for the earlier commit above, not for the newly added cases. Also not done: a real OS clipboard write (the tests stub the clipboard), browsers other than Chromium, a screen reader, and a physical mobile device.
- **Independent reviews: 1 of 3 rounds consumed.** Round 1 was explicitly adopted into the plugin review ledger as historical_unverified, with no synthetic clean reviews and no approval. Its P1 findings remain unresolved pending independent review round 2, which has not started. Not approved. The requested project `.claude` files remain blocked/pending; the plugin did not implement them.
- **Deployment: NOT DONE, NOT AUTHORIZED in this phase.** Deployment and preview are unimplemented. A CI workflow (`.github/workflows/ci.yml`) has run only on the earlier commit above; later commits count only once observed on an exact commit. The owner supplies and configures the Cloudflare GitHub Secrets. Nothing is live.
- **Escaped/terminal JSON handling: conservative subset implemented** (see [Encoded JSON containers](#encoded-json-containers)). No exact terminal sample was provided, so other formats remain unsupported. The new Playwright tests await CI (not executed in a browser).
- **Cleanup of coexisting partial core modules: STILL PENDING.** `features/json/lib/` contains earlier partial modules (`tokenize.ts`, `validate.ts`, `render.ts`, `limits.ts`) alongside the modules the public API actually uses (`tokenizer.ts`, `grammar.ts`, `pretty.ts`, `minify.ts`, `duplicate-keys.ts`, `position.ts`, `types.ts`, `index.ts`). They have not been removed or reconciled.

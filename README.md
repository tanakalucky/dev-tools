# dev-tools

Browser-only developer utilities. Tool input is processed locally in the browser: it is not sent over the network, not persisted, and not tracked.

## Status

Work in progress. **Not deployed, not approved, and not yet checked in a real browser.**

- Implemented: a JSON formatter at `/` and `/json` (format with 2 spaces, minify, validate, duplicate-key warnings, copy, clear). See [docs/tools/json/spec.md](docs/tools/json/spec.md).
- Last verified: GitHub Actions succeeded on commit 16d94360e590265fc99db8ac7202ad558fbae32a (run 38021075480): 133 unit tests, typecheck, lint, format check, build and 13 Playwright tests in real Chromium passed. That evidence is for that commit only. Local browser startup stays blocked in this environment (`os.networkInterfaces` error inside `@cloudflare/vite-plugin`). A separate warning about an unresolved optional peer (`react-server-dom-webpack/static.edge`) is unrelated to that; `@vitejs/plugin-rsc` vendors its own copy, so the package is intentionally not added.
- CI: `.github/workflows/ci.yml` is written (unit tests, typecheck, lint, format check, build, then Playwright E2E on Node 24, read-only permissions, no secrets). It succeeded on the commit named above; later commits count only once observed.
- Review: 1 of 3 rounds consumed (external, historical_unverified, no approval); round 2 is pending and not started.
- Encoded JSON (conservative): pasting a JSON string literal whose content is an object or array, e.g. `"{\"a\":1}"`, is decoded by exactly one layer and formatted; large numbers, key order, duplicate keys and inner escapes are preserved. Line and column numbers then refer to the decoded text, and a checkbox (on by default) turns decoding off. Limits (1 MiB input, depth, output) apply to the original and decoded text. Unsupported: raw shell quoting, prompts or prefixes, arbitrary backslash removal, double-encoded or deeper layers, encoded scalars, unknown terminal formats. Ordinary JSON strings remain strings. No exact terminal sample was provided, so not all terminal pastes are handled. The related unit and Playwright tests await CI.
- Not done, not authorized in this phase: deployment and preview. The stack is [vinext](https://vinext.dev) targeting Cloudflare Workers; nothing is live.

## Setup

Declares Node.js 22.12 or newer (declared, not tested as a version matrix).

```sh
npm install
npm run dev
```

Then open the local URL printed by the dev server. The home page lists the tools; the JSON formatter is at `/json`.

## Scripts

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the local dev server                   |
| `npm run build`     | Production build                             |
| `npm test`          | Run the unit tests (vitest)                  |
| `npm run test:e2e`  | Run the browser tests (Playwright, Chromium) |
| `npm run typecheck` | Type-check with `tsc --noEmit`               |
| `npm run lint`      | Lint with oxlint                             |
| `npm run fmt:check` | Check formatting with oxfmt                  |
| `npm run format`    | Apply formatting with oxfmt                  |

`npm run test:e2e` starts `npm run dev` on `127.0.0.1:43173` and runs `e2e/*.pw.ts` in Chromium only. It needs a Playwright Chromium build, installed once with `npx playwright install chromium`. What the browser tests cover and what is still pending is listed in the [JSON spec](docs/tools/json/spec.md#browser-tests).

There is no deploy command yet.

## Layout

- `app/` - pages: the home/tool list and the `/json` tool.
- `lib/json/` - the pure JSON core (no DOM, no network). Public entry point: `lib/json/index.ts`.
- `lib/size-limit.ts` - the shared input size cap.
- `e2e/` - Playwright browser tests (`*.pw.ts`), configured in `playwright.config.ts`.
- `docs/tools/<tool>/` - per-tool specs. Currently: [JSON](docs/tools/json/spec.md).

## Documentation

- JSON tool spec: [docs/tools/json/spec.md](docs/tools/json/spec.md)
- Contributor and agent workflow: [CLAUDE.md](CLAUDE.md)

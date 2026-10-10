# dev-tools

Browser-only developer utilities. Tool input is processed locally in the browser: it is not sent over the network, not persisted, and not tracked.

## Status

Early work in progress. **Not deployed, not reviewed, and not yet checked in a real browser** (browser tests are written but have no recorded passing run).

- Implemented: a JSON formatter at the `/json` route (format with 2 spaces, minify, validate, duplicate-key warnings, copy, clear). See [docs/tools/json/spec.md](docs/tools/json/spec.md) for what it does and what is still pending.
- Planned, not implemented: unwrapping JSON that is encoded inside a JSON string, and cleanup of pasted terminal/shell output.
- Planned, not done: deployment. The stack is [vinext](https://vinext.dev) targeting Cloudflare Workers; the intended production URL `dev-tools.tanakalucky.com` is not live.

## Setup

Requires Node.js 22.12 or newer.

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

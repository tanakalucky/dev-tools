# dev-tools

Browser-only developer utilities on vinext + Cloudflare Workers.

## Status

Foundation for tools. No features implemented yet.

- Preview runs on GitHub Actions ([docs/deploy/README.md](docs/deploy/README.md)). There is no production deploy.
- The stack is [vinext](https://vinext.dev) targeting Cloudflare Workers.
- CI: `.github/workflows/ci.yml` (typecheck, lint, format check, build, Node 24 Playwright E2E, read-only permissions, no secrets).

## Setup

Declares Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Then open the local URL printed by the dev server.

## Scripts

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the local dev server                   |
| `npm run build`     | Production build                             |
| `npm run test:e2e`  | Run the browser tests (Playwright, Chromium) |
| `npm run typecheck` | Type-check with `tsc --noEmit`               |
| `npm run lint`      | Lint with oxlint                             |
| `npm run fmt:check` | Check formatting with oxfmt                  |
| `npm run format`    | Apply formatting with oxfmt                  |

`npm run test:e2e` starts `npm run dev` on `127.0.0.1:43173` and runs `e2e/*.pw.ts` in Chromium only. It needs a Playwright Chromium build, installed once with `npx playwright install chromium`.

There is no deploy command yet.

## Layout

- `app/` - Root layout and home page.
- `e2e/` - Playwright browser tests (`*.pw.ts`), configured in `playwright.config.ts`.

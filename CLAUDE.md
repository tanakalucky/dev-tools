# dev-tools

Browser-only developer utilities on vinext + Cloudflare Workers. Public repo: https://github.com/tanakalucky/dev-tools.

This file is behavioral guidance, not a permission boundary.

## Status

- Implemented: the JSON formatter UI and pure core, at `/` (tool list) and `/json`. Spec: [docs/tools/json/spec.md](docs/tools/json/spec.md).
- Last verified evidence: 133 unit tests passing; typecheck, oxlint, oxfmt check and the production build each exited 0. Playwright discovers 13 E2E cases; **0 browser tests have been executed**.
- Browser E2E is blocked by an environment error: `uv_interface_addresses returned Unknown system error 1`, raised from `os.networkInterfaces()` inside `@cloudflare/vite-plugin` when the dev server starts. Cloudflare behaviour is not bypassed.
- Separate from that: a build warning that `react-server-dom-webpack/static.edge` (and its `package.json`) cannot be resolved. plugin-rsc 0.5.36 marks it an optional peer and vendors its own copy (`dist/vendor/react-server-dom`), using the external package only when installed, so it is deliberately not added. This is a different issue from the browser-startup error and is not treated as the cause of it.
- Review status: **1 of 3 review rounds consumed** (one independent three-perspective round, run externally). Its P1 findings are being addressed and are unresolved until verified. Review round 2 is pending. The change is not approved and not all gates have passed.
- The Node minimum version (22.12) is declared in the docs, not tested as a version matrix.
- CI: `.github/workflows/ci.yml` is written but **NOT YET RUN**; it counts only once published and observed on an exact commit. Playwright still has 0 browser executions.
- Deployment and preview are not implemented and not authorized in this phase. The owner supplies and configures the Cloudflare GitHub Secrets themselves. No site is live.
- Open requirement (not optional, not waived): handling of escaped/terminal-pasted JSON, awaiting a sample from the owner. Ordinary JSON strings remain strings.
- Never invent commands; add commands here only after they exist and have been run. Scripts that exist: `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run fmt:check`, `npm run format`, `npm run build`, `npm run dev`.

## Workflow

1. Lead (Opus, main session) scopes the change against the tool spec.
2. Research is chosen by the lead only when an uncertainty blocks a decision. Cap: 3 candidates, 5 official pages, 5 minutes. It is not a mandatory launch of researchers.
3. A separate Sonnet implementer writes code, tests, docs and all fixes.
4. The lead verifies the actual files and actual test output itself. Agent summaries are not evidence.
5. Review round: separate read-only Sonnet reviewers for security, test adequacy, and design/rules/docs. All three perspectives together form one round.
6. The implementer fixes, the lead re-verifies, and a next round runs if needed.

The workflow plugin is installed at user scope. Repo-specific configuration (repo `.claude` roles and rules) is **unfinished and blocked**: it is not installed, not copied and not authoritative. See [docs/development/claude-config-pending/README.md](docs/development/claude-config-pending/README.md).

Reviewers are read-only (Read, Glob, Grep). Agent contexts from the same model can share blind spots, so the lead's own verification is still required.

## Findings and severity

Every finding: priority, `file:line`, impact, reproduction/evidence, suggested resolution.

- **P0**: security/privacy breach, data loss or corruption, or broken core behavior. Fix mandatory.
- **P1**: defect, spec violation, or missing/weakened required test. Fix mandatory.
- **P2**: improvement. Optional.

## Round cap and escalation

- Maximum **three rounds total** per change, including the initial round. No resets after fixes or after a PR is opened.
- Round 1 was an external review. Migrating it into the plugin's review ledger is pending; the count is 1, not 0.
- At the cap, STOP and consult the user if any of these remain: unresolved P0/P1, material disagreement, or a required test that is unverified.
- Weakening a test or a rule requires an explicit user decision.
- Never report a review as complete if a reviewer did not actually run and inspect the change.

## Docs

- Tool specs: `docs/tools/<tool>/`, starting with [docs/tools/json/spec.md](docs/tools/json/spec.md)
- `docs/development/claude-config-pending/` holds inert, unfinished repo-specific drafts. Nothing loads them.

# dev-tools

Browser-only developer utilities on vinext + Cloudflare Workers. Public repo: https://github.com/tanakalucky/dev-tools.

This file is behavioral guidance, not a permission boundary.

## Status

- Implemented: the JSON formatter UI and pure core, at `/` (tool list) and `/json`. Spec: [docs/tools/json/spec.md](docs/tools/json/spec.md).
- Last verified evidence: GitHub Actions succeeded on commit 16d94360e590265fc99db8ac7202ad558fbae32a (run 38021075480): 133 unit tests, typecheck, lint, format check, build, and 13 Playwright tests in real Chromium all passed. That evidence is for that commit ONLY. The encoded-input unit and Playwright tests added after it are awaiting CI and have not been browser-executed.
- Local browser E2E startup remains blocked by an environment error: `uv_interface_addresses returned Unknown system error 1`, raised from `os.networkInterfaces()` inside `@cloudflare/vite-plugin` when the dev server starts. Cloudflare behaviour is not bypassed.
- Separate from that: a build warning that `react-server-dom-webpack/static.edge` (and its `package.json`) cannot be resolved. plugin-rsc 0.5.36 marks it an optional peer and vendors its own copy (`dist/vendor/react-server-dom`), using the external package only when installed, so it is deliberately not added. The warning was nonfatal in CI and remains deliberately unaddressed; it is a different issue from the browser-startup error.
- Review status: **1 of 3 review rounds consumed**. Historical round 1 (external, three perspectives) was explicitly adopted into the external review ledger and remains recorded as historical_unverified, with no fabricated approval. Review round 2 is pending and not started. The change is not approved.
- The Node minimum version (22.12) is declared in the docs, not tested as a version matrix.
- CI: `.github/workflows/ci.yml` ran successfully on the commit named above; later commits count only once observed in CI.
- Deployment and preview are not implemented and not authorized in this phase. The owner supplies and configures the Cloudflare GitHub Secrets themselves. No site is live.
- Encoded JSON (implemented, conservative): input that is exactly one JSON string literal whose content starts with `{` or `[` is decoded by exactly one layer (`lib/json/encoded.ts`), then formatted by the normal token-preserving path; opt-out checkbox in the UI. Ordinary JSON strings remain strings. No exact terminal sample was provided, so other formats (shell quoting, prompts/prefixes, double-encoding, encoded scalars, arbitrary backslash removal) remain unsupported.
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
- Round 1 was an external review, explicitly adopted into the external review ledger and recorded as historical_unverified (no fabricated approval). The count is 1 of 3; round 2 is pending and not started.
- At the cap, STOP and consult the user if any of these remain: unresolved P0/P1, material disagreement, or a required test that is unverified.
- Weakening a test or a rule requires an explicit user decision.
- Never report a review as complete if a reviewer did not actually run and inspect the change.

## Docs

- Tool specs: `docs/tools/<tool>/`, starting with [docs/tools/json/spec.md](docs/tools/json/spec.md)
- `docs/development/claude-config-pending/` holds inert, unfinished repo-specific drafts. Nothing loads them.

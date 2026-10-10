# dev-tools

Browser-only developer utilities on vinext + Cloudflare Workers. Public repo: https://github.com/tanakalucky/dev-tools.

This file is behavioral guidance, not a permission boundary.

## Status

- Implemented: the JSON formatter UI and pure core, at `/` (tool list) and `/json`. Spec: [docs/tools/json/spec.md](docs/tools/json/spec.md).
- CI: head 51aace6 で unit 177 件と Chromium E2E 17 件が成功した。この変更(shadcn/ui 導入)後の結果は未確定で、CI で観測されるまで成功に数えない。
- Local browser E2E startup remains blocked by an environment error: `uv_interface_addresses returned Unknown system error 1`, raised from `os.networkInterfaces()` inside `@cloudflare/vite-plugin` when the dev server starts. Cloudflare behaviour is not bypassed.
- Separate from that: a build warning that `react-server-dom-webpack/static.edge` (and its `package.json`) cannot be resolved. plugin-rsc 0.5.36 marks it an optional peer and vendors its own copy (`dist/vendor/react-server-dom`), using the external package only when installed, so it is deliberately not added. The warning was nonfatal in CI and remains deliberately unaddressed; it is a different issue from the browser-startup error.
- Review status: **2 of 3 review rounds consumed**. The final round has not been run. The change is not approved.
- The Node minimum version (22.12) is declared in the docs, not tested as a version matrix.
- CI: `.github/workflows/ci.yml`。import 依存の機械検査仕様は [tools/oxlint-boundaries/README.md](tools/oxlint-boundaries/README.md) が正本。
- Preview runs on GitHub Actions ([docs/deploy/README.md](docs/deploy/README.md)). There is no production deploy. The owner supplies and configures the Cloudflare GitHub Secrets themselves.
- Encoded JSON (implemented, conservative): input that is exactly one JSON string literal whose content starts with `{` or `[` is decoded by exactly one layer (`features/json/lib/encoded.ts`), then formatted by the normal token-preserving path; opt-out checkbox in the UI. Ordinary JSON strings remain strings. No exact terminal sample was provided, so other formats (shell quoting, prompts/prefixes, double-encoding, encoded scalars, arbitrary backslash removal) remain unsupported.
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
- Rounds 1 and 2 are consumed (2 of 3); the final round has not been run.
- At the cap, STOP and consult the user if any of these remain: unresolved P0/P1, material disagreement, or a required test that is unverified.
- Weakening a test or a rule requires an explicit user decision.
- Never report a review as complete if a reviewer did not actually run and inspect the change.

## Docs

- Tool specs: `docs/tools/<tool>/`, starting with [docs/tools/json/spec.md](docs/tools/json/spec.md)
- `docs/development/claude-config-pending/` holds inert, unfinished repo-specific drafts. Nothing loads them.

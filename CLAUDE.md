# dev-tools

Browser-only developer utilities on vinext + Cloudflare Workers. Public repo: https://github.com/tanakalucky/dev-tools.

This file is behavioral guidance, not a permission boundary.

## Status

- Scaffold only (vinext + Cloudflare Vite plugin v2 + `cloudflare.config.ts`). The homepage is a placeholder; the JSON MVP is not built. Never invent commands; add commands here only after they exist and have been run.
- Commands, as last run locally on 2026-10-10 (Node 24.19.0, npm 11.9.0):
  - `npm install`: passed.
  - `npm run test` (`vitest run`): passed.
  - `npm run build` (`vite build`, writes `.cloudflare/output/`): passed.
  - `npm run typecheck` (`tsc --noEmit`): passed.
  - `npm run lint` (`oxlint`): exit 0, no diagnostics printed.
  - `npm run fmt:check` (`oxfmt --check`): FAILS on the pre-existing `docs/development/claude-config-pending/README.md` only; scaffold files are clean.
  - `npm run format` (`oxfmt`): only ever run against `app/globals.css` and `package.json`, not repo-wide.
  - `npm run dev` (`vite`): not run.
  - No deploy command exists or has been run.
- Review rounds used for the MVP change: 0 of 3.
- Remote deployment acceptance: not done (blocked on parent-provided credentials).
- Git remote, publication, deploy and auth are handled by the parent, not here.

## Workflow

1. Lead (Opus) scopes the change against the tool spec.
2. `technology-researcher` and `codebase-researcher` gather facts (read-only).
3. `implementer` writes code, tests, docs and all fixes.
4. Lead verifies the actual diff and actual test output itself. Agent summaries are not evidence.
5. Review round: three fresh-context reviewers, `security-reviewer`, `test-adequacy-reviewer`, `design-rules-docs-reviewer`. All three perspectives together form one round.
6. Implementer fixes, lead re-verifies, next round if needed.

Reviewers are read-only (Read, Glob, Grep). They never get Bash, Write or Edit; an unrestricted shell is not read-only. Agent contexts from the same model can share blind spots, so the lead's own verification is still required.

## Findings and severity

Every finding: priority, `file:line`, impact, reproduction/evidence, suggested resolution.

- **P0**: security/privacy breach, data loss or corruption, or broken core behavior. Fix mandatory.
- **P1**: defect, spec violation, or missing/weakened required test. Fix mandatory.
- **P2**: improvement. Optional.

## Round cap and escalation

- Maximum **three rounds total** per change, including the initial round. No resets after fixes or after a PR is opened.
- At the cap, STOP and consult the user if any of these remain: unresolved P0/P1, material disagreement, or a required test that is unverified.
- Weakening a test or a rule requires an explicit user decision.
- Never report a review as complete if a reviewer did not actually run and inspect the change.

## Docs

- Rules: [.claude/rules/security.md](.claude/rules/security.md), [.claude/rules/testing.md](.claude/rules/testing.md), [.claude/rules/design.md](.claude/rules/design.md)
- Agent roles: `.claude/agents/`
- Tool specs: `docs/tools/<tool>/`, starting with [docs/tools/json/spec.md](docs/tools/json/spec.md)
- `docs/development/claude-config-pending/` holds inactive earlier drafts; `.claude/` is authoritative.

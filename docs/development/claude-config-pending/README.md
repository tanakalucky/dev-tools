# Pending Claude configuration (unfinished, blocked)

Status: repo-specific Claude configuration is **unfinished and blocked**. Nothing here is installed, copied into `.claude/`, authoritative, or delivered.

The files in this directory are inert earlier drafts. Nothing loads agents or rules from here. Writing under `.claude/` was not permitted in earlier phases and has not been worked around.

## What actually runs

The workflow plugin is installed at user scope. The actual workflow is: an Opus main lead, a separate Sonnet implementer, and separate read-only Sonnet reviewers for security, test adequacy and design/rules/docs. See [CLAUDE.md](../../../CLAUDE.md).

## Notes on the drafts

- The drafts may be stale and have not been reconciled with the user-scope plugin.
- `technology-researcher` is not a mandatory step. The lead chooses research only when an uncertainty blocks a decision (cap: 3 candidates, 5 official pages, 5 minutes).
- Implementation is not blocked by this directory: the workflow runs through the user-scope plugin.
- Any future repo-specific setup needs an explicit decision by the repository owner.

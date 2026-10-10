# Pending Claude configuration (not installed)

These files are the intended contents of `.claude/agents/` and `.claude/rules/`.

They are **not installed**. The Phase 1 session was not permitted to write under `.claude/`, and the lead did not work around that. In this directory the files are inert: nothing loads agents or rules from here.

## To install

Someone with authority over the repository configuration copies them into place:

| From                                                 | To                |
| ---------------------------------------------------- | ----------------- |
| `docs/development/claude-config-pending/agents/*.md` | `.claude/agents/` |
| `docs/development/claude-config-pending/rules/*.md`  | `.claude/rules/`  |

Then delete this directory, so there is one copy and it cannot drift.

## Why this blocks Phase 2

The workflow in `docs/development/workflow.md` requires the implementer and the three reviewers to be native agents with the tool lists defined here. Until these definitions are installed, those agent types do not exist and implementation must not start.

`CLAUDE.md` refers to the installed locations, not to this directory.

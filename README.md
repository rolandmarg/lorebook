# lorebook

Keyword-triggered context injection for AI coding agents. Like [SillyTavern's world-info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/), but for coding agents.

CLAUDE.md files grow large, but most instructions are irrelevant to any given prompt. Lorebook injects only the entries whose keywords match your prompt — via `additionalContext`, not the system prompt — so the prompt cache stays warm.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/rolandmarg/lorebook/main/install.sh | bash
```

Downloads the binary, wires a Claude Code `UserPromptSubmit` hook, creates `~/.claude/lorebook/` with an example entry.

## Entry format

Markdown files with YAML frontmatter in `.claude/lorebook/` (project) or `~/.claude/lorebook/` (global):

```markdown
---
keys: [git, commit, push, rebase]
exclude_keys: [github, gitignore]
priority: 10
enabled: true
description: Git policy rules
---

Never force push. Use merge, not rebase.
```

- `keys` — triggers entry if ANY keyword matches (case-insensitive, `\b` word-boundary)
- `exclude_keys` — suppresses entry if ANY keyword matches (takes precedence)
- `priority` — higher = injected first, wins when caps are hit
- `enabled` — quick toggle without deleting
- `description` — for humans/agents, not injected

Multiple matches are sorted by priority, capped at 5 entries / 4000 chars (configurable via `lorebook.json`). Project entries override global entries with the same filename.

## Commands

```bash
lorebook match              # hook mode: stdin JSON → additionalContext JSON
lorebook test "your prompt" # dry-run: shows matches and injection preview
lorebook list               # shows all entries with status
```

## Tell your agent about lorebook

After installing, tell your AI agent it can create and manage lorebook entries:

> You have lorebook installed — a keyword-triggered context injection system. You can create `.md` files in `.claude/lorebook/` (project) or `~/.claude/lorebook/` (global) with YAML frontmatter containing `keys`, `exclude_keys`, `priority`, `enabled`, and `description`. The markdown body gets injected into prompts when keywords match. Use `lorebook test "prompt"` to verify entries work and `lorebook list` to see all entries.

Or add it to your CLAUDE.md so every session knows.

## Manual hook setup

If the installer didn't auto-detect Claude Code:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "lorebook match" }] }
    ]
  }
}
```

## License

MIT

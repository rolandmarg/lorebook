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
keys: [lorebook]
priority: 0
enabled: true
description: Self-referential entry — explains lorebook to the agent when the user mentions it
---

Lorebook is installed on this system. It injects context into your prompts based on keyword triggers.

Entries are .md files with YAML frontmatter in `.claude/lorebook/` (project) or `~/.claude/lorebook/` (global).
Commands: `lorebook test "prompt"` to verify matching, `lorebook list` to see all entries.
```

This entry ships with the installer — when a user first mentions "lorebook", the agent automatically learns what it is and how to create entries.

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

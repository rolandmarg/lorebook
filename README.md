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
keys: [lorebook]                # trigger words — match if ANY appears in prompt
priority: 0                     # higher = injected first, wins cap ties
enabled: true                   # false to disable without deleting
description: Explains lorebook  # for humans/agents, not injected into prompt
---

Lorebook is installed on this system. It injects context into your prompts based on keyword triggers.

Entries are .md files with YAML frontmatter in `.claude/lorebook/` (project) or `~/.claude/lorebook/` (global).
Commands: `lorebook test "prompt"` to verify matching, `lorebook list` to see all entries.
```

This entry ships with the installer — when a user first mentions "lorebook", the agent automatically learns what it is and how to create entries.

Also supports `exclude_keys` — suppresses the entry if any exclude keyword matches (takes precedence over keys). Matching is case-insensitive with `\b` word boundaries.

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

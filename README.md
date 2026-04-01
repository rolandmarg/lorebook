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

```yaml
# ~/.claude/lorebook/lorebook.md
---
keys: [lorebook]          # match if ANY appears
priority: 0               # higher = first
enabled: true             # toggle off/on
description: Self-docs    # not injected
---

Lorebook is installed. It injects context based
on keyword triggers. Use `lorebook test "prompt"`
to verify, `lorebook list` to see all entries.
```

This ships with the installer — when "lorebook" is mentioned, the agent learns what it is.

### Frontmatter fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `keys` | `string[]` | yes | — | Trigger words. Entry matches if ANY keyword appears in the prompt. Case-insensitive, `\b` word-boundary. |
| `exclude_keys` | `string[]` | no | `[]` | Suppression words. Entry is skipped if ANY exclude keyword appears. Takes precedence over `keys`. |
| `priority` | `number` | no | `0` | Higher = injected first, wins when caps are hit. |
| `enabled` | `boolean` | no | `true` | Quick toggle without deleting the file. |
| `description` | `string` | no | `""` | For humans/agents. Not injected into the prompt. |

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

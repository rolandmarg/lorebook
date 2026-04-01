# lorebook

Keyword-triggered context injection for AI coding agents. Like [SillyTavern's world-info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/), but for coding agents.

CLAUDE.md files grow large, but most instructions are irrelevant to any given prompt. Lorebook injects only matching entries via `additionalContext` — the system prompt stays cached.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/rolandmarg/lorebook/main/install.sh | bash
```

Downloads the binary, wires a Claude Code `UserPromptSubmit` hook, creates `~/.claude/lorebook/` with a starter entry.

## Entry format

Markdown files in `.claude/lorebook/` (project) or `~/.claude/lorebook/` (global):

```yaml
# ~/.claude/lorebook/lorebook.md
---
keys: [lorebook]  # trigger keywords
---
Body below is injected before your prompt when
keywords match (does not break prompt cache).
Create .md entries with YAML frontmatter: keys,
exclude_keys, priority, enabled. Matching is
case-insensitive with word boundaries.
`lorebook test` to verify.
https://github.com/rolandmarg/lorebook
```

## Commands

```bash
lorebook test "your prompt" # shows what would match
lorebook list               # shows all entries
```

## License

MIT

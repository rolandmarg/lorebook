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
              # ↓ injected before your prompt
              #   does not break prompt cache

Lorebook injects context into prompts when
keywords match. Entries are .md files in
.claude/lorebook/ or ~/.claude/lorebook/.

Frontmatter: keys (triggers on ANY match),
exclude_keys (suppresses), priority (higher
= first), enabled (default true). Matching
is case-insensitive with word boundaries.

Verify: `lorebook test "prompt"`
List:   `lorebook list`
```

## Commands

```bash
lorebook test "your prompt" # shows what would match
lorebook list               # shows all entries
```

## License

MIT

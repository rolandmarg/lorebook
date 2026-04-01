# lorebook

Keyword-triggered context injection for AI coding agents. inspired by [SillyTavern's world-info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/)

CLAUDE.md files grow large, but most instructions are irrelevant to any given prompt.

Lorebook injects only matching entries via XML tags before user prompt.

It does not break the prompt cache!

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/rolandmarg/lorebook/main/install.sh | bash
```

Downloads the binary, wires a Claude Code `UserPromptSubmit` hook, creates `~/.claude/lorebook/` with a starter entry.

### Codex CLI

Lorebook works with OpenAI Codex CLI too — same hook protocol. Add to `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "lorebook match"
          }
        ]
      }
    ]
  }
}
```

Both agents share entries from `.claude/lorebook/` (project) and `~/.claude/lorebook/` (global).

## Entry format

Markdown files in `.claude/lorebook/` (project) or `~/.claude/lorebook/` (global):

```yaml
# ~/.claude/lorebook/lorebook.md
---
keys: [lorebook]  # trigger keywords
---
Lorebook injects context into prompts when
keywords match. Create .md entries with YAML
frontmatter: keys, exclude_keys, priority,
enabled. Case-insensitive, word-boundary
matching. `lorebook test` to verify.
https://github.com/rolandmarg/lorebook
```

### Injecting file content

Entries can inject content from existing project files instead of embedding it inline:

```yaml
# .claude/lorebook/design.md
---
keys: [design, philosophy]
inject_files: [PHILOSOPHY.md, IDEAS.md]
---
Optional preamble text.
```

File paths are relative to the project root. Content from referenced files is appended to the entry body. Missing files are skipped with a stderr warning.

## Commands

```bash
lorebook test "your prompt" # shows what would match
lorebook list               # shows all entries
```

## License

MIT

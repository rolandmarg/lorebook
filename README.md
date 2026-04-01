# lorebook

Keyword-triggered context injection for AI coding agents. Inspired by [SillyTavern's](https://docs.sillytavern.app/usage/core-concepts/worldinfo/) lorebook/world-info system, adapted for coding agent harnesses.

**The problem:** CLAUDE.md files grow large but most instructions are irrelevant to any given prompt. Loading everything wastes context and can't be cached efficiently.

**The solution:** Lorebook entries are markdown files with keyword triggers. When you submit a prompt, only the entries matching your keywords get injected — keeping the system prompt static and cache-stable.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/OWNER/lorebook/main/install.sh | bash
```

This downloads the binary, detects Claude Code, wires the hook, and creates `~/.claude/lorebook/` with an example entry. One command, fully wired.

## How it works

1. You submit a prompt in Claude Code
2. The `UserPromptSubmit` hook runs `lorebook match`
3. Lorebook scans your prompt for keyword matches against entries
4. Matched entries are injected as `additionalContext` (not system prompt — cache stays warm)
5. Claude sees the relevant instructions right next to your message

## Create entries

Entries are `.md` files with YAML frontmatter in `.claude/lorebook/` (project) or `~/.claude/lorebook/` (global):

```markdown
---
keys: [git, commit, push, rebase, branch, merge]
exclude_keys: [github, gitignore]
priority: 10
enabled: true
description: Git policy rules for commits and branch management
---

Never force push. Use merge, not rebase. Always create new commits rather than amending pushed commits.
```

### Frontmatter fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `keys` | `string[]` | yes | — | Keywords that trigger this entry (case-insensitive, word-boundary) |
| `exclude_keys` | `string[]` | no | `[]` | Keywords that suppress this entry |
| `priority` | `number` | no | `0` | Higher = injected first, wins cap ties |
| `enabled` | `boolean` | no | `true` | Quick toggle |
| `description` | `string` | no | `""` | For humans/agents, not injected |

### Matching rules

- **Case-insensitive** — "Git" matches "git", "GIT"
- **Word boundaries** — "git" matches "git push" but not "digit" or "gitignore"
- **ANY key triggers** — entry matches if at least one key appears
- **ANY exclude suppresses** — entry skipped if any exclude_key appears

## Commands

### `lorebook match`

Hook mode. Reads Claude Code's JSON from stdin, outputs `additionalContext` JSON. This is what the hook calls — you don't run it manually.

### `lorebook test "<prompt>"`

Dry-run. Shows which entries match and the injection preview:

```
$ lorebook test "fix the git deploy to vast gpu"

Matched 2 of 7 entries:

  git-policy (priority: 10)
    matched: git

  gpu-transfers (priority: 5)
    matched: vast, gpu

Injection preview (387 chars, 2/5 entries):
──────────────────────────────────────────
<lorebook-context>
<entry name="git-policy" keywords="git">
Never force push...
</entry>
</lorebook-context>
```

### `lorebook list`

Shows all discovered entries:

```
$ lorebook list

Project (.claude/lorebook/):
  git-policy.md    priority:10  keys:[git,commit,push]  enabled

Global (~/.claude/lorebook/):
  security.md      priority:20  keys:[secret,credential]  enabled

2 entries (2 enabled, 0 disabled)
```

## Stacking and caps

When multiple entries match, they're sorted by priority (highest first) and included until either cap is hit:

- **Entry cap**: max 5 entries (default)
- **Character cap**: max 4000 chars (default)

Entries that exceed the char cap are skipped, not truncated. Configure with `lorebook.json`:

```json
{
  "maxEntries": 5,
  "maxChars": 4000
}
```

Place in `.claude/lorebook/lorebook.json` (project) or `~/.claude/lorebook/lorebook.json` (global).

## Directory resolution

1. **Project**: `.claude/lorebook/` (relative to cwd) — committed to repo, shared with team
2. **Global**: `~/.claude/lorebook/` — personal defaults

Project entries override global entries with the same filename.

## Manual setup

If the install script couldn't auto-detect Claude Code, add this to `~/.claude/settings.json`:

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

## License

MIT

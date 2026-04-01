# Lorebook — Keyword-Triggered Context Injection for AI Coding Agents

**Date:** 2026-03-31
**Status:** Design approved
**Repository:** New public GitHub repo (`lorebook`)

## Overview

Lorebook is a keyword-triggered context injection system for AI coding agents. It brings the SillyTavern lorebook/world-info pattern to coding agent harnesses — conditionally injecting relevant instructions based on what the user is talking about, rather than loading everything into the system prompt.

Entries are markdown files with YAML frontmatter containing keyword triggers. When a user submits a prompt in Claude Code, a `UserPromptSubmit` hook runs `lorebook match`, which scans the prompt for keyword hits and injects matched entries as `additionalContext`. The system prompt stays static and cache-stable.

## Design Principles

- **AI agents are first-class citizens.** Most interactions happen through Claude Code or an AI harness. The CLI exists to be a fast, reliable hook — not an interactive tool. Agents author entries by writing markdown files directly.
- **Cache-preserving injection.** Context is injected via `additionalContext` on the user message, never into the system prompt. This preserves prompt cache across turns.
- **Zero-config defaults.** Install script handles everything: binary download, Claude Code hook wiring, example entry. User's next prompt is already lorebook-aware.
- **Minimal surface area.** Three CLI commands (`match`, `test`, `list`). No scaffolding commands, no interactive wizards, no config generators.

## Entry Format

Each entry is a `.md` file in a lorebook directory:

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

### Frontmatter Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `keys` | `string[]` | yes | — | Keywords that trigger this entry. Match is case-insensitive, word-boundary. Entry triggers if ANY key matches. |
| `exclude_keys` | `string[]` | no | `[]` | Keywords that suppress this entry. If ANY exclude key matches, the entry is skipped even if keys match. |
| `priority` | `number` | no | `0` | Higher priority entries are injected first and closer to the user message. Wins ties when caps are hit. |
| `enabled` | `boolean` | no | `true` | Quick toggle without deleting the file. |
| `description` | `string` | no | `""` | Human/agent-readable description of what this entry provides. Not injected into context. |

### Matching Rules

- **Case-insensitive**: "Git" matches "git", "GIT", "Git"
- **Word-boundary matching**: uses `\b` regex boundaries — "git" matches "git push" but not "digit" or "gitignore"
- **ANY-key trigger**: entry matches if at least one key appears in the prompt
- **ANY-exclude suppresses**: entry is skipped if at least one exclude_key appears in the prompt
- **Exclude takes precedence**: if both a key and an exclude_key match, the entry is skipped

## Injection Format

Matched entries are wrapped in XML tags (Anthropic's recommended prompt structuring mechanism) and delivered via the `additionalContext` field in the hook's JSON output:

```xml
<lorebook-context>
<entry name="git-policy" keywords="git, commit, push">
Never force push. Use merge, not rebase. Always create new commits rather than amending pushed commits.
</entry>
<entry name="gpu-transfers" keywords="gpu, vast, worker">
Download large files on GPU workers, never locally. Use aria2c for downloads.
</entry>
</lorebook-context>
```

The `name` attribute is the entry's filename (without extension). The `keywords` attribute lists the keys that actually matched, for transparency.

## Stacking and Caps

When multiple entries match a single prompt:

1. All matching entries are collected
2. Sorted by priority (highest first), then alphabetically by filename for ties
3. Entries are added one by one until either cap is reached:
   - **Entry cap**: maximum number of entries (default: 5)
   - **Character cap**: maximum total characters of injected content (default: 4000)
4. An entry that would exceed the character cap is **skipped** (not truncated) — try the next one
5. Character count is measured on the entry's markdown body only (not XML wrapper overhead)

## Directory Resolution

Lorebook scans these directories in order, merging all entries:

1. **Project-level**: `.claude/lorebook/` (relative to `cwd` from hook input) — committed to repo, shared with team
2. **Global**: `~/.claude/lorebook/` — user-wide defaults, personal preferences

When both directories contain an entry with the same filename, the project-level entry wins (overrides the global one).

## CLI Commands

### `lorebook match`

Hook mode. Reads Claude Code's `UserPromptSubmit` JSON from stdin, scans for keyword matches, outputs JSON to stdout.

**Input** (stdin):
```json
{
  "session_id": "abc123",
  "cwd": "/home/user/myproject",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "fix the git deploy to the vast gpu"
}
```

**Output** (stdout, exit 0):
```json
{
  "additionalContext": "<lorebook-context>\n<entry name=\"git-policy\" keywords=\"git\">...</entry>\n<entry name=\"gpu-transfers\" keywords=\"vast, gpu\">...</entry>\n</lorebook-context>"
}
```

If no entries match, outputs empty JSON `{}` and exits 0 (no context injected, prompt proceeds normally).

### `lorebook test "<prompt text>"`

Dry-run mode. Shows which entries would match and the full injection preview without submitting a real prompt.

**Usage:**
```bash
lorebook test "fix the git deploy to vast gpu"
```

**Output:**
```
Matched 2 of 7 entries:

  git-policy (priority: 10)
    matched: git
    excluded: —

  gpu-transfers (priority: 5)
    matched: vast, gpu
    excluded: —

Injection preview (387 chars, 2/5 entries):
──────────────────────────────────────────
<lorebook-context>
<entry name="git-policy" keywords="git">
Never force push...
</entry>
<entry name="gpu-transfers" keywords="vast, gpu">
Download large files on GPU workers...
</entry>
</lorebook-context>
```

### `lorebook list`

Shows all discovered entries with their status, keywords, and priority.

**Usage:**
```bash
lorebook list
```

**Output:**
```
Project (.claude/lorebook/):
  git-policy.md       priority:10  keys:[git,commit,push,rebase,branch,merge]  enabled
  gpu-transfers.md    priority:5   keys:[gpu,vast,worker,model,deploy]         enabled

Global (~/.claude/lorebook/):
  security.md         priority:20  keys:[secret,credential,env,password,key]   enabled
  testing.md          priority:0   keys:[test,spec,jest,vitest]                disabled

4 entries (3 enabled, 1 disabled)
```

## Hook Integration

The installer adds this to `~/.claude/settings.json`:

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

`UserPromptSubmit` does not support matchers — the hook fires on every prompt submit. Lorebook handles its own filtering (keyword matching) and returns empty JSON when nothing matches.

## Configuration

Optional `lorebook.json` in the lorebook directory or its parent:

```json
{
  "maxEntries": 5,
  "maxChars": 4000
}
```

**Resolution order** (first found wins):
1. `.claude/lorebook/lorebook.json` (project)
2. `.claude/lorebook.json` (project, sibling)
3. `~/.claude/lorebook/lorebook.json` (global)
4. `~/.claude/lorebook.json` (global, sibling)
5. Built-in defaults (`maxEntries: 5`, `maxChars: 4000`)

Project config does not merge with global config — first found wins entirely.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/lorebook/main/install.sh | bash
```

> **Note:** `<owner>` is a placeholder — the GitHub org/user will be decided when the repo is created.

### What the install script does

1. **Detect OS and arch**: linux/darwin, x64/arm64
2. **Download binary**: compiled Bun binary from GitHub Releases to `~/.local/bin/lorebook`
3. **Ensure PATH**: warn if `~/.local/bin` is not on PATH
4. **Detect Claude Code**: check if `~/.claude/` exists
5. **Wire hook**: merge `UserPromptSubmit` hook into `~/.claude/settings.json` (non-destructive — reads existing JSON, adds the hook entry, preserves everything else)
6. **Create lorebook directory**: `~/.claude/lorebook/` with one example entry
7. **Print confirmation**: summary of what was installed and where

### What the install script does NOT do

- Overwrite existing hooks or settings
- Require sudo or root
- Install a runtime (Bun, Node, etc.) — the binary is self-contained
- Create project-level config (that's up to the user/agent)

## Build and Distribution

### Stack

- **Language**: TypeScript
- **Runtime**: Bun (development and compilation)
- **Build**: `bun build --compile` produces self-contained executables with no runtime dependency
- **Test**: `bun test`

### Cross-compilation targets

| OS | Arch | Binary name |
|----|------|-------------|
| Linux | x64 | `lorebook-linux-x64` |
| Linux | arm64 | `lorebook-linux-arm64` |
| macOS | x64 | `lorebook-darwin-x64` |
| macOS | arm64 | `lorebook-darwin-arm64` |

### CI (GitHub Actions)

- On push to `main`: run tests + typecheck + lint
- On tag `v*`: cross-compile all targets, create GitHub Release with binaries + install.sh

## Project Structure

```
lorebook/
├── src/
│   ├── index.ts          — CLI entry point, command routing (match|test|list)
│   ├── match.ts          — keyword matching engine (word-boundary, case-insensitive)
│   ├── resolve.ts        — directory resolution, entry loading, YAML frontmatter parsing
│   └── inject.ts         — XML wrapping, priority sorting, cap enforcement
├── test/
│   ├── match.test.ts     — matching engine: keyword hits, exclude keys, boundary cases
│   ├── resolve.test.ts   — entry loading: frontmatter parsing, directory merge, overrides
│   └── inject.test.ts    — injection: XML format, priority order, entry cap, char cap
├── install.sh            — one-liner installer (detect OS, download binary, wire Claude Code)
├── README.md             — user-facing docs
├── CLAUDE.md             — agent instructions for contributing
├── package.json
├── tsconfig.json
└── LICENSE               — MIT
```

## Out of Scope (v1)

These are explicitly deferred:

- **Semantic/fuzzy matching** — v1 is keyword-only. Semantic matching is a natural v2 feature.
- **Depth/turn injection** — SillyTavern's depth parameter (inject N turns back). Not useful for coding agents.
- **Regex patterns** — keywords only. Regex can be added later without breaking the format.
- **Plugin distribution** — Claude Code plugin packaging. CLI + hook is simpler and more portable.
- **Other agent harnesses** — Cursor, Copilot, etc. The matching engine is harness-agnostic; only the hook wiring is Claude Code specific. Other integrations can be added later.
- **Entry templating** — dynamic content in entries (variables, conditionals). Entries are static markdown.
- **Remote/shared lorebooks** — fetching entries from URLs or shared repos. Copy the files.

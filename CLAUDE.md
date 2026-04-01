# Agent Instructions

## What This Is

lorebook is a keyword-triggered context injection CLI for AI coding agents. It integrates with Claude Code's `UserPromptSubmit` hook to inject relevant lorebook entries based on keyword matches in the user's prompt.

## Stack

- TypeScript + Bun
- gray-matter for YAML frontmatter parsing
- `bun build --compile` for self-contained binaries
- `bun test` for testing

## Architecture

Three pure modules composed by a thin CLI:

- `src/match.ts` — keyword matching engine (`\b` word boundaries, case-insensitive)
- `src/resolve.ts` — directory resolution, entry loading, frontmatter parsing, config loading
- `src/inject.ts` — XML wrapping, priority sorting, cap enforcement
- `src/index.ts` — CLI entry point, command routing (match|test|list)

## Commands

```bash
bun test          # run tests
bun run typecheck # typecheck
bun run build     # compile for current platform
```

## Before Committing

Run ALL and confirm they pass:
1. `bun test`
2. `bun run typecheck`

## Key Design Decisions

- Entries are markdown files with YAML frontmatter in `.claude/lorebook/` (project) or `~/.claude/lorebook/` (global)
- Injection via `additionalContext` in hook output, NOT system prompt modification (cache preservation)
- Fail-safe: if anything goes wrong in `match` mode, output `{}` and exit 0 — never break the user's prompt
- `resolveEntries` and `loadConfig` accept an optional `globalBase` parameter for testing without mocking `homedir()`
- Keywords use `\b` word boundaries — designed for regular words, not special characters like `c++`

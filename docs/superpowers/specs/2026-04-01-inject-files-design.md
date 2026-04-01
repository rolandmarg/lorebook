# File Injection for Lorebook Entries

**Date:** 2026-04-01
**Status:** Design

## Problem

Lorebook entries currently embed all injected content inline. When a project has existing files (e.g. `PHILOSOPHY.md`, `IDEAS.md`) that should be injected on keyword match, the entry author must copy-paste their content into the lorebook entry, which goes stale as the source files evolve.

## Solution

Add an `inject_files` frontmatter field to lorebook entries. At entry load time, referenced files are read and their content is appended to the entry's body. Everything downstream (matching, injection, char budgets) works unchanged.

## Entry Format

```yaml
---
keys: [design, philosophy]
inject_files: [PHILOSOPHY.md, IDEAS.md]
---
Optional preamble text.
```

- `inject_files`: array of file paths relative to project root (cwd). Default `[]`.
- If the entry body is non-empty, file contents are appended after it (newline-separated).
- If the entry body is empty, the combined file contents become the entire content.

## Data Model

Add to `LorebookEntry` in `resolve.ts`:

```ts
injectFiles: string[];  // parsed from frontmatter, default []
```

No changes to `Matchable`, `MatchResult`, `InjectionEntry`, or any other existing types.

## File Resolution

Happens in `resolve.ts` during entry loading:

1. `parseEntry()` reads `inject_files` from frontmatter, stores as `entry.injectFiles`.
2. File resolution is called in `resolveEntries()` after collecting all entries, since it has access to `cwd`. A new function `resolveFileContent(entry, cwd)` handles each entry.
3. For each path in `injectFiles`:
   - Resolve against `cwd` (not the lorebook directory).
   - If file exists: read contents, append to `entry.content` with newline separator.
   - If file missing: write warning to stderr (`[lorebook] warning: file not found: <path>`), skip.
4. Combined content is stored in `entry.content`. Downstream code sees a normal entry.

## Global Entries

For global entries (`~/.claude/lorebook/`), `inject_files` paths still resolve against `cwd` (the project directory). A global entry with `inject_files: [PHILOSOPHY.md]` injects the current project's `PHILOSOPHY.md` if it exists. If it doesn't, the warning fires and the file is skipped. This is intentional — it lets global entries reference project-specific files that may or may not be present.

## Limits

File content counts against `maxChars` and `maxEntries` like any other content. No exemptions or separate limits. Users injecting large files should adjust `lorebook.json` accordingly.

## What Doesn't Change

- `match.ts` — keyword matching is unrelated to content.
- `inject.ts` — already operates on `entry.content` and enforces char/entry budgets.
- `index.ts` — `runMatch`, `handleTest`, `handleList` pipelines work as-is.
- `hook.ts` — hook protocol types unchanged.
- `log.ts` — invocation logging unchanged.

## Display

- `lorebook list`: show injected file paths alongside keys when present (e.g. `files:[PHILOSOPHY.md,IDEAS.md]`).
- `lorebook test`: no changes needed — injection preview already shows full content.

## Testing

- Unit test: entry with `inject_files` pointing at existing file → content includes file contents.
- Unit test: entry with body + `inject_files` → body comes first, then file contents.
- Unit test: entry with `inject_files` pointing at missing file → warning on stderr, file skipped, entry still works.
- Unit test: entry with empty body and all files missing → content is empty string.
- Unit test: global entry with `inject_files` resolves against cwd, not global lorebook dir.

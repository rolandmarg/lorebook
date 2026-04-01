# Source Tracking & Invocation Logging

Two features: (1) show which file each injected entry came from, (2) log invocations for auditing.

## Feature 1: Source File Tracking

### Data Model Change

Add `filePath` to `LorebookEntry`:

```typescript
export interface LorebookEntry {
  // ...existing fields...
  filePath: string; // relative display path, e.g. ".claude/lorebook/foo.md" or "~/.claude/lorebook/foo.md"
}
```

Set during `parseEntry()` — pass the resolved file path in, convert to a relative display form:
- Project entries: `.claude/lorebook/<name>.md` (relative to cwd)
- Global entries: `~/.claude/lorebook/<name>.md`

### XML Output Change

Add `source` attribute to `<entry>` tags in `buildInjection()`:

```xml
<entry name="lorebook" source=".claude/lorebook/lorebook.md" keywords="lorebook">
content here
</entry>
```

### Stderr Output

In `handleMatch()`, after successful matching, write one line per matched entry to stderr:

```
[lorebook] .claude/lorebook/lorebook.md (keys: lorebook)
[lorebook] ~/.claude/lorebook/git-policy.md (keys: git, commit)
```

Stderr does not interfere with the JSON stdout that Claude Code reads from the hook.

### Affected Files

- `src/resolve.ts` — add `filePath` to interface, set it in `parseEntry()`, pass file path through
- `src/inject.ts` — add `source` attribute to `<entry>` XML tag
- `src/index.ts` — add stderr output in `handleMatch()`
- Tests updated accordingly

## Feature 2: Invocation Logging

### New Module

`src/log.ts` — single exported function:

```typescript
export function logInvocation(prompt: string, entries: LogEntry[], logPath?: string): void
```

### Log File

- Location: `~/.claude/lorebook/lorebook.log`
- Format: JSONL (one JSON object per line)
- Matches-only: skip invocations where nothing matched

### Log Entry Format

```json
{
  "timestamp": "2026-03-31T22:04:00.000Z",
  "prompt": "feedback: lorebook should show user that it loaded context...",
  "entries": [
    { "name": "lorebook", "source": ".claude/lorebook/lorebook.md", "keywords": ["lorebook"] }
  ]
}
```

- `entries` contains headers only — name, source path, matched keywords. No body content.
- `prompt` is the full prompt text that triggered the match.

### Behavior

- Called from `runMatch()` after matching completes, before returning results.
- Fire-and-forget: if the write fails (permissions, disk full, etc.), swallow the error silently. Never break the hook.
- `logPath` parameter optional, for testing without writing to the real log file.

### Affected Files

- `src/log.ts` — new module (~20 lines)
- `src/index.ts` — call `logInvocation()` from `runMatch()`
- `test/log.test.ts` — new test file

## Changes NOT Being Made

- No log rotation or cleanup — append-only, user can truncate manually.
- No config for log location — hardcoded to `~/.claude/lorebook/lorebook.log`.
- No logging of zero-match invocations — matches-only to avoid noise.

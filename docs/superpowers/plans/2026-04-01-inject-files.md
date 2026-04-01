# inject_files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow lorebook entries to inject content from external project files via an `inject_files` frontmatter field.

**Architecture:** Add `injectFiles` to `LorebookEntry`, parse it from frontmatter in `parseEntry()`, resolve file contents in `resolveEntries()` by appending them to `entry.content`. Everything downstream (matching, injection, budgets) is untouched.

**Tech Stack:** TypeScript, Bun, bun:test

---

### Task 1: Add `injectFiles` to data model and parseEntry

**Files:**
- Modify: `src/resolve.ts:6-16` (LorebookEntry interface)
- Modify: `src/resolve.ts:18-33` (parseEntry function)
- Test: `test/resolve.test.ts`

- [ ] **Step 1: Write failing test for parseEntry with inject_files**

Add to `test/resolve.test.ts` inside the `parseEntry` describe block:

```ts
test('parses inject_files from frontmatter', () => {
  const entry = parseEntry(join(FIXTURES, 'with-inject-files.md'), 'project', '.claude/lorebook/with-inject-files.md');
  expect(entry.injectFiles).toEqual(['PHILOSOPHY.md', 'IDEAS.md']);
});

test('defaults injectFiles to empty array', () => {
  const entry = parseEntry(join(FIXTURES, 'minimal.md'), 'global', '~/.claude/lorebook/minimal.md');
  expect(entry.injectFiles).toEqual([]);
});
```

Create test fixture `test/fixtures/with-inject-files.md`:

```markdown
---
keys: [design]
inject_files: [PHILOSOPHY.md, IDEAS.md]
---

Design preamble.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/resolve.test.ts`
Expected: FAIL — `injectFiles` property does not exist on LorebookEntry.

- [ ] **Step 3: Add injectFiles to LorebookEntry and parseEntry**

In `src/resolve.ts`, add `injectFiles` to the `LorebookEntry` interface:

```ts
export interface LorebookEntry {
  name: string;
  keys: string[];
  excludeKeys: string[];
  priority: number;
  enabled: boolean;
  description: string;
  content: string;
  injectFiles: string[];
  source: 'project' | 'global';
  filePath: string;
}
```

In `parseEntry()`, add parsing after the `description` line:

```ts
injectFiles: Array.isArray(data.inject_files) ? data.inject_files.map(String) : [],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/resolve.test.ts`
Expected: All PASS.

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (no type errors).

- [ ] **Step 6: Commit**

```bash
git add src/resolve.ts test/resolve.test.ts test/fixtures/with-inject-files.md
git commit -m "feat: add injectFiles field to LorebookEntry and parseEntry"
```

---

### Task 2: Implement resolveFileContent and wire into resolveEntries

**Files:**
- Modify: `src/resolve.ts:42-51` (resolveEntries function)
- Test: `test/resolve.test.ts`

- [ ] **Step 1: Write failing test — inject_files appends file content**

Add a new describe block to `test/resolve.test.ts`:

```ts
import { resolveEntries } from '../src/resolve';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('inject_files resolution', () => {
  function setupProject(entries: Record<string, string>, files: Record<string, string> = {}): string {
    const tmp = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const dir = join(tmp, '.claude', 'lorebook');
    mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(entries)) {
      writeFileSync(join(dir, name), content);
    }
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(tmp, name), content);
    }
    return tmp;
  }

  test('appends file content to entry', () => {
    const cwd = setupProject(
      { 'design.md': '---\nkeys: [design]\ninject_files: [PHILOSOPHY.md]\n---\nPreamble.' },
      { 'PHILOSOPHY.md': 'Be minimal.' }
    );
    const entries = resolveEntries(cwd, cwd);
    expect(entries[0]!.content).toBe('Preamble.\n\nBe minimal.');
    rmSync(cwd, { recursive: true, force: true });
  });

  test('empty body with inject_files uses only file content', () => {
    const cwd = setupProject(
      { 'design.md': '---\nkeys: [design]\ninject_files: [PHILOSOPHY.md]\n---' },
      { 'PHILOSOPHY.md': 'Be minimal.' }
    );
    const entries = resolveEntries(cwd, cwd);
    expect(entries[0]!.content).toBe('Be minimal.');
    rmSync(cwd, { recursive: true, force: true });
  });

  test('multiple inject_files are appended in order', () => {
    const cwd = setupProject(
      { 'design.md': '---\nkeys: [design]\ninject_files: [A.md, B.md]\n---' },
      { 'A.md': 'File A.', 'B.md': 'File B.' }
    );
    const entries = resolveEntries(cwd, cwd);
    expect(entries[0]!.content).toBe('File A.\n\nFile B.');
    rmSync(cwd, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/resolve.test.ts`
Expected: FAIL — content does not include file contents.

- [ ] **Step 3: Implement resolveFileContent and wire into resolveEntries**

In `src/resolve.ts`, add `resolveFileContent` function after `parseEntry`:

```ts
export function resolveFileContent(entry: LorebookEntry, cwd: string): void {
  if (entry.injectFiles.length === 0) return;

  const parts: string[] = [];
  if (entry.content) parts.push(entry.content);

  for (const filePath of entry.injectFiles) {
    const resolved = join(cwd, filePath);
    if (existsSync(resolved)) {
      parts.push(readFileSync(resolved, 'utf-8').trim());
    } else {
      process.stderr.write(`[lorebook] warning: file not found: ${filePath}\n`);
    }
  }

  entry.content = parts.join('\n\n');
}
```

In `resolveEntries()`, add file resolution after collecting entries, before the return:

```ts
export function resolveEntries(cwd: string, globalBase?: string): LorebookEntry[] {
  const projectDir = join(cwd, '.claude', 'lorebook');
  const globalDir = join(globalBase ?? homedir(), '.claude', 'lorebook');

  const projectEntries = loadEntriesFromDir(projectDir, 'project', '.claude/lorebook');
  const globalEntries = loadEntriesFromDir(globalDir, 'global', '~/.claude/lorebook');

  const projectNames = new Set(projectEntries.map((e) => e.name));
  const entries = [...projectEntries, ...globalEntries.filter((e) => !projectNames.has(e.name))];

  for (const entry of entries) {
    resolveFileContent(entry, cwd);
  }

  return entries;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/resolve.test.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/resolve.ts test/resolve.test.ts
git commit -m "feat: resolve inject_files content in resolveEntries"
```

---

### Task 3: Missing file warning and edge cases

**Files:**
- Modify: (no new source changes — testing existing behavior)
- Test: `test/resolve.test.ts`

- [ ] **Step 1: Write test for missing file warning on stderr**

Add to the `inject_files resolution` describe block in `test/resolve.test.ts`:

```ts
test('warns on stderr for missing file', () => {
  const cwd = setupProject(
    { 'design.md': '---\nkeys: [design]\ninject_files: [MISSING.md]\n---\nPreamble.' },
  );
  const stderrChunks: string[] = [];
  const origWrite = process.stderr.write;
  process.stderr.write = (chunk: any) => { stderrChunks.push(String(chunk)); return true; };
  try {
    const entries = resolveEntries(cwd, cwd);
    expect(entries[0]!.content).toBe('Preamble.');
    expect(stderrChunks.some(c => c.includes('MISSING.md'))).toBe(true);
  } finally {
    process.stderr.write = origWrite;
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('empty body and all files missing yields empty content', () => {
  const cwd = setupProject(
    { 'design.md': '---\nkeys: [design]\ninject_files: [MISSING.md]\n---' },
  );
  const origWrite = process.stderr.write;
  process.stderr.write = () => true;
  try {
    const entries = resolveEntries(cwd, cwd);
    expect(entries[0]!.content).toBe('');
  } finally {
    process.stderr.write = origWrite;
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('global entry resolves inject_files against cwd', () => {
  const projectDir = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
  const globalDir = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
  const gLorebook = join(globalDir, '.claude', 'lorebook');
  mkdirSync(gLorebook, { recursive: true });
  writeFileSync(join(gLorebook, 'design.md'), '---\nkeys: [design]\ninject_files: [PHILOSOPHY.md]\n---');
  writeFileSync(join(projectDir, 'PHILOSOPHY.md'), 'Project philosophy.');
  const entries = resolveEntries(projectDir, globalDir);
  expect(entries[0]!.content).toBe('Project philosophy.');
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(globalDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `bun test test/resolve.test.ts`
Expected: All PASS (implementation from Task 2 already handles these cases).

- [ ] **Step 3: Run full test suite and typecheck**

Run: `bun test && bun run typecheck`
Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add test/resolve.test.ts
git commit -m "test: add edge case tests for inject_files"
```

---

### Task 4: Update `lorebook list` display

**Files:**
- Modify: `src/index.ts:158-165` (printEntries function inside handleList)

- [ ] **Step 1: Update printEntries to show inject_files**

In `src/index.ts`, modify the `printEntries` function inside `handleList`:

```ts
function printEntries(label: string, items: typeof entries): void {
  if (items.length === 0) return;
  console.log(`${label}:`);
  for (const e of items) {
    const status = e.enabled ? 'enabled' : 'disabled';
    const keys = e.keys.join(',');
    const files = e.injectFiles.length > 0 ? `\tfiles:[${e.injectFiles.join(',')}]` : '';
    console.log(`  ${e.name}.md\tpriority:${e.priority}\tkeys:[${keys}]${files}\t${status}`);
  }
  console.log('');
}
```

- [ ] **Step 2: Update help text to document inject_files**

In `src/index.ts`, update the `printHelp` function's frontmatter fields section:

```ts
  Frontmatter fields:
    keys: [word, ...]       Required. Triggers on ANY keyword match.
    exclude_keys: [...]     Suppresses if ANY match.
    priority: <number>      Higher = injected first. Default: 0
    enabled: <boolean>      Default: true
    inject_files: [...]     File paths (relative to project root) to inject.
```

- [ ] **Step 3: Run full test suite and typecheck**

Run: `bun test && bun run typecheck`
Expected: All PASS.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: show inject_files in lorebook list and help output"
```

---

### Task 5: Update README and lorebook self-entry

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add inject_files to README frontmatter fields section**

Find the frontmatter fields table/section in `README.md` and add `inject_files` with a brief description:

```
| `inject_files` | `[...]`   | File paths (relative to project root) whose content is appended to the entry. |
```

Add a short example showing an entry with `inject_files`.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document inject_files in README"
```

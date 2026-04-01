# Lorebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a keyword-triggered context injection CLI that integrates with Claude Code's `UserPromptSubmit` hook, distributed as a self-contained compiled binary.

**Architecture:** Three pure modules (`match`, `resolve`, `inject`) composed by a thin CLI entry point. `match` handles keyword-to-prompt matching with `\b` word boundaries. `resolve` loads entries from project + global lorebook directories and parses YAML frontmatter. `inject` sorts by priority, enforces caps, and wraps in XML. The CLI reads stdin JSON in hook mode and outputs `additionalContext` JSON.

**Tech Stack:** TypeScript, Bun (runtime + compiler + test runner), gray-matter (frontmatter parsing)

**Spec:** `docs/design.md`

**Working directory:** Create new repo at `~/lorebook` (or user-specified location). This is a standalone public repo, NOT part of sf-human.

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.ts` (placeholder)
- Create: `.gitignore`

- [ ] **Step 1: Create repo directory and initialize git**

```bash
mkdir -p ~/lorebook && cd ~/lorebook
git init
```

- [ ] **Step 2: Create package.json**

Create `package.json`:

```json
{
  "name": "lorebook",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "bun build --compile src/index.ts --outfile lorebook",
    "build:all": "bun run build:linux-x64 && bun run build:linux-arm64 && bun run build:darwin-x64 && bun run build:darwin-arm64",
    "build:linux-x64": "bun build --compile --target=bun-linux-x64 src/index.ts --outfile dist/lorebook-linux-x64",
    "build:linux-arm64": "bun build --compile --target=bun-linux-arm64 src/index.ts --outfile dist/lorebook-linux-arm64",
    "build:darwin-x64": "bun build --compile --target=bun-darwin-x64 src/index.ts --outfile dist/lorebook-darwin-x64",
    "build:darwin-arm64": "bun build --compile --target=bun-darwin-arm64 src/index.ts --outfile dist/lorebook-darwin-arm64",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.8"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "types": ["bun"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 4: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
lorebook
*.tgz
```

- [ ] **Step 5: Create placeholder entry point**

Create `src/index.ts`:

```typescript
const command = process.argv[2];

if (!command || !['match', 'test', 'list'].includes(command)) {
  console.error('Usage: lorebook <match|test|list>');
  process.exit(1);
}
```

- [ ] **Step 6: Install dependencies and verify**

```bash
cd ~/lorebook && bun install
bun run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json .gitignore src/index.ts bun.lock
git commit -m "chore: project scaffolding"
```

---

### Task 2: Matching Engine

**Files:**
- Create: `src/match.ts`
- Create: `test/match.test.ts`

- [ ] **Step 1: Write failing tests for matchKeywords**

Create `test/match.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { matchKeywords, matchEntry } from '../src/match';

describe('matchKeywords', () => {
  test('matches case-insensitively', () => {
    expect(matchKeywords('Fix the Git issue', ['git'])).toEqual(['git']);
  });

  test('respects word boundaries — no partial matches', () => {
    expect(matchKeywords('digit', ['git'])).toEqual([]);
  });

  test('respects word boundaries — no prefix matches', () => {
    expect(matchKeywords('gitignore', ['git'])).toEqual([]);
  });

  test('respects word boundaries — no suffix matches', () => {
    expect(matchKeywords('ungit', ['git'])).toEqual([]);
  });

  test('matches at start of string', () => {
    expect(matchKeywords('git push origin', ['git'])).toEqual(['git']);
  });

  test('matches at end of string', () => {
    expect(matchKeywords('run the git', ['git'])).toEqual(['git']);
  });

  test('returns all matching keywords', () => {
    expect(matchKeywords('git push to remote', ['git', 'push', 'merge'])).toEqual(['git', 'push']);
  });

  test('returns empty array for no matches', () => {
    expect(matchKeywords('hello world', ['git', 'push'])).toEqual([]);
  });

  test('handles multi-word keywords', () => {
    expect(matchKeywords('never force push to main', ['force push'])).toEqual(['force push']);
  });

  test('handles empty keywords array', () => {
    expect(matchKeywords('git push', [])).toEqual([]);
  });

  test('handles empty prompt', () => {
    expect(matchKeywords('', ['git'])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/lorebook && bun test test/match.test.ts
```

Expected: FAIL — `matchKeywords` is not exported / does not exist.

- [ ] **Step 3: Write matchKeywords implementation**

Create `src/match.ts`:

```typescript
function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

export function matchKeywords(prompt: string, keywords: string[]): string[] {
  return keywords.filter((kw) => keywordRegex(kw).test(prompt));
}
```

- [ ] **Step 4: Run tests to verify matchKeywords passes**

```bash
cd ~/lorebook && bun test test/match.test.ts
```

Expected: all `matchKeywords` tests PASS.

- [ ] **Step 5: Add failing tests for matchEntry**

Append to `test/match.test.ts`:

```typescript
describe('matchEntry', () => {
  const entry = { keys: ['git', 'commit'], excludeKeys: [] as string[], enabled: true };

  test('returns matched keys when key found', () => {
    const result = matchEntry('fix the git issue', entry);
    expect(result).toEqual({ matchedKeys: ['git'] });
  });

  test('returns multiple matched keys', () => {
    const result = matchEntry('git commit --amend', entry);
    expect(result).toEqual({ matchedKeys: ['git', 'commit'] });
  });

  test('returns null when disabled', () => {
    expect(matchEntry('git push', { ...entry, enabled: false })).toBeNull();
  });

  test('returns null when exclude key matches', () => {
    const withExclude = { ...entry, excludeKeys: ['github'] };
    expect(matchEntry('check the github repo', withExclude)).toBeNull();
  });

  test('exclude takes precedence — both key and exclude_key match', () => {
    const withExclude = { keys: ['deploy'], excludeKeys: ['deploy script'], enabled: true };
    expect(matchEntry('run the deploy script', withExclude)).toBeNull();
  });

  test('returns null when no keys match', () => {
    expect(matchEntry('hello world', entry)).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests to verify matchEntry tests fail**

```bash
cd ~/lorebook && bun test test/match.test.ts
```

Expected: `matchEntry` tests FAIL.

- [ ] **Step 7: Implement matchEntry**

Add to `src/match.ts`:

```typescript
export interface MatchResult {
  matchedKeys: string[];
}

export interface Matchable {
  keys: string[];
  excludeKeys: string[];
  enabled: boolean;
}

export function matchEntry(prompt: string, entry: Matchable): MatchResult | null {
  if (!entry.enabled) return null;

  const excludeHits = matchKeywords(prompt, entry.excludeKeys);
  if (excludeHits.length > 0) return null;

  const matchedKeys = matchKeywords(prompt, entry.keys);
  if (matchedKeys.length === 0) return null;

  return { matchedKeys };
}
```

- [ ] **Step 8: Run all tests to verify they pass**

```bash
cd ~/lorebook && bun test test/match.test.ts
```

Expected: all tests PASS.

- [ ] **Step 9: Typecheck**

```bash
cd ~/lorebook && bun run typecheck
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
cd ~/lorebook
git add src/match.ts test/match.test.ts
git commit -m "feat: keyword matching engine with word-boundary support"
```

---

### Task 3: Entry Resolution

**Files:**
- Create: `src/resolve.ts`
- Create: `test/resolve.test.ts`
- Create: `test/fixtures/` (temp fixture entries for tests)

- [ ] **Step 1: Create test fixture entries**

Create `test/fixtures/git-policy.md`:

```markdown
---
keys: [git, commit, push, rebase]
exclude_keys: [github, gitignore]
priority: 10
enabled: true
description: Git policy rules
---

Never force push. Use merge, not rebase.
```

Create `test/fixtures/gpu-transfers.md`:

```markdown
---
keys: [gpu, vast, worker]
priority: 5
description: GPU file transfer rules
---

Download large files on GPU workers, never locally.
```

Create `test/fixtures/disabled-entry.md`:

```markdown
---
keys: [test, spec]
enabled: false
description: Disabled testing rules
---

This should not be loaded as active.
```

Create `test/fixtures/minimal.md`:

```markdown
---
keys: [minimal]
---

Entry with only required fields.
```

- [ ] **Step 2: Write failing tests for parseEntry**

Create `test/resolve.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import { parseEntry } from '../src/resolve';

const FIXTURES = join(import.meta.dir, 'fixtures');

describe('parseEntry', () => {
  test('parses all frontmatter fields', () => {
    const entry = parseEntry(join(FIXTURES, 'git-policy.md'), 'project');
    expect(entry.name).toBe('git-policy');
    expect(entry.keys).toEqual(['git', 'commit', 'push', 'rebase']);
    expect(entry.excludeKeys).toEqual(['github', 'gitignore']);
    expect(entry.priority).toBe(10);
    expect(entry.enabled).toBe(true);
    expect(entry.description).toBe('Git policy rules');
    expect(entry.content).toBe('Never force push. Use merge, not rebase.');
    expect(entry.source).toBe('project');
  });

  test('applies defaults for optional fields', () => {
    const entry = parseEntry(join(FIXTURES, 'minimal.md'), 'global');
    expect(entry.excludeKeys).toEqual([]);
    expect(entry.priority).toBe(0);
    expect(entry.enabled).toBe(true);
    expect(entry.description).toBe('');
    expect(entry.source).toBe('global');
  });

  test('parses disabled entries', () => {
    const entry = parseEntry(join(FIXTURES, 'disabled-entry.md'), 'project');
    expect(entry.enabled).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd ~/lorebook && bun test test/resolve.test.ts
```

Expected: FAIL — `parseEntry` does not exist.

- [ ] **Step 4: Implement parseEntry**

Create `src/resolve.ts`:

```typescript
import matter from 'gray-matter';
import { readFileSync } from 'fs';
import { basename } from 'path';

export interface LorebookEntry {
  name: string;
  keys: string[];
  excludeKeys: string[];
  priority: number;
  enabled: boolean;
  description: string;
  content: string;
  source: 'project' | 'global';
}

export function parseEntry(filePath: string, source: 'project' | 'global'): LorebookEntry {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    name: basename(filePath, '.md'),
    keys: Array.isArray(data.keys) ? data.keys.map(String) : [],
    excludeKeys: Array.isArray(data.exclude_keys) ? data.exclude_keys.map(String) : [],
    priority: typeof data.priority === 'number' ? data.priority : 0,
    enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
    description: typeof data.description === 'string' ? data.description : '',
    content: content.trim(),
    source,
  };
}
```

- [ ] **Step 5: Run tests to verify parseEntry passes**

```bash
cd ~/lorebook && bun test test/resolve.test.ts
```

Expected: all `parseEntry` tests PASS.

- [ ] **Step 6: Add failing tests for resolveEntries**

Append to `test/resolve.test.ts`:

```typescript
import { resolveEntries } from '../src/resolve';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('resolveEntries', () => {
  function makeTempLorebook(entries: Record<string, string>): string {
    const tmp = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const dir = join(tmp, '.claude', 'lorebook');
    mkdirSync(dir, { recursive: true });
    for (const [name, content] of Object.entries(entries)) {
      writeFileSync(join(dir, name), content);
    }
    return tmp;
  }

  const ENTRY_A = `---\nkeys: [alpha]\npriority: 1\n---\nAlpha content.`;
  const ENTRY_B = `---\nkeys: [beta]\npriority: 2\n---\nBeta content.`;
  const ENTRY_A_OVERRIDE = `---\nkeys: [alpha]\npriority: 99\n---\nOverridden alpha.`;

  test('loads entries from project directory', () => {
    const cwd = makeTempLorebook({ 'alpha.md': ENTRY_A, 'beta.md': ENTRY_B });
    const entries = resolveEntries(cwd, cwd);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.name).sort()).toEqual(['alpha', 'beta']);
    expect(entries.find((e) => e.name === 'alpha')!.source).toBe('project');
    rmSync(cwd, { recursive: true, force: true });
  });

  test('loads entries from global directory', () => {
    const globalDir = makeTempLorebook({ 'alpha.md': ENTRY_A });
    const projectDir = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const entries = resolveEntries(projectDir, globalDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.source).toBe('global');
    rmSync(globalDir, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  test('project entries override global entries with same filename', () => {
    const projectDir = makeTempLorebook({ 'alpha.md': ENTRY_A_OVERRIDE });
    const globalDir = makeTempLorebook({ 'alpha.md': ENTRY_A, 'beta.md': ENTRY_B });
    const entries = resolveEntries(projectDir, globalDir);
    expect(entries).toHaveLength(2);
    const alpha = entries.find((e) => e.name === 'alpha')!;
    expect(alpha.priority).toBe(99);
    expect(alpha.source).toBe('project');
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(globalDir, { recursive: true, force: true });
  });

  test('returns empty array when no lorebook directories exist', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const entries = resolveEntries(tmp, tmp);
    expect(entries).toEqual([]);
    rmSync(tmp, { recursive: true, force: true });
  });
});
```

- [ ] **Step 7: Run tests to verify resolveEntries tests fail**

```bash
cd ~/lorebook && bun test test/resolve.test.ts
```

Expected: FAIL — `resolveEntries` not exported or wrong signature.

- [ ] **Step 8: Implement resolveEntries**

Note: `resolveEntries` takes `cwd` (project root) and `globalBase` (global home dir) as separate arguments. This makes testing possible without mocking `homedir()`. In production, `globalBase` defaults to `homedir()`.

Add to `src/resolve.ts`:

```typescript
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

function loadEntriesFromDir(dir: string, source: 'project' | 'global'): LorebookEntry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseEntry(join(dir, f), source));
}

export function resolveEntries(cwd: string, globalBase?: string): LorebookEntry[] {
  const projectDir = join(cwd, '.claude', 'lorebook');
  const globalDir = join(globalBase ?? homedir(), '.claude', 'lorebook');

  const projectEntries = loadEntriesFromDir(projectDir, 'project');
  const globalEntries = loadEntriesFromDir(globalDir, 'global');

  const projectNames = new Set(projectEntries.map((e) => e.name));
  return [...projectEntries, ...globalEntries.filter((e) => !projectNames.has(e.name))];
}
```

- [ ] **Step 9: Run all resolve tests**

```bash
cd ~/lorebook && bun test test/resolve.test.ts
```

Expected: all tests PASS.

- [ ] **Step 10: Add failing tests for loadConfig**

Append to `test/resolve.test.ts`:

```typescript
import { loadConfig } from '../src/resolve';

describe('loadConfig', () => {
  test('returns defaults when no config file exists', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const config = loadConfig(tmp, tmp);
    expect(config).toEqual({ maxEntries: 5, maxChars: 4000 });
    rmSync(tmp, { recursive: true, force: true });
  });

  test('loads config from project lorebook directory', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const dir = join(tmp, '.claude', 'lorebook');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'lorebook.json'), JSON.stringify({ maxEntries: 3, maxChars: 2000 }));
    const config = loadConfig(tmp, tmp);
    expect(config).toEqual({ maxEntries: 3, maxChars: 2000 });
    rmSync(tmp, { recursive: true, force: true });
  });

  test('falls through to global config', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const globalDir = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const gDir = join(globalDir, '.claude', 'lorebook');
    mkdirSync(gDir, { recursive: true });
    writeFileSync(join(gDir, 'lorebook.json'), JSON.stringify({ maxEntries: 10 }));
    const config = loadConfig(projectDir, globalDir);
    expect(config.maxEntries).toBe(10);
    expect(config.maxChars).toBe(4000); // default for missing field
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(globalDir, { recursive: true, force: true });
  });

  test('project config wins over global config', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const globalDir = mkdtempSync(join(tmpdir(), 'lorebook-test-'));
    const pDir = join(projectDir, '.claude', 'lorebook');
    mkdirSync(pDir, { recursive: true });
    writeFileSync(join(pDir, 'lorebook.json'), JSON.stringify({ maxEntries: 2, maxChars: 1000 }));
    const gDir = join(globalDir, '.claude', 'lorebook');
    mkdirSync(gDir, { recursive: true });
    writeFileSync(join(gDir, 'lorebook.json'), JSON.stringify({ maxEntries: 99, maxChars: 9999 }));
    const config = loadConfig(projectDir, globalDir);
    expect(config).toEqual({ maxEntries: 2, maxChars: 1000 });
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(globalDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 11: Implement loadConfig**

Add to `src/resolve.ts`:

```typescript
export interface LorebookConfig {
  maxEntries: number;
  maxChars: number;
}

const DEFAULT_CONFIG: LorebookConfig = { maxEntries: 5, maxChars: 4000 };

export function loadConfig(cwd: string, globalBase?: string): LorebookConfig {
  const home = globalBase ?? homedir();
  const candidates = [
    join(cwd, '.claude', 'lorebook', 'lorebook.json'),
    join(cwd, '.claude', 'lorebook.json'),
    join(home, '.claude', 'lorebook', 'lorebook.json'),
    join(home, '.claude', 'lorebook.json'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, 'utf-8'));
      return {
        maxEntries: typeof raw.maxEntries === 'number' ? raw.maxEntries : DEFAULT_CONFIG.maxEntries,
        maxChars: typeof raw.maxChars === 'number' ? raw.maxChars : DEFAULT_CONFIG.maxChars,
      };
    }
  }

  return DEFAULT_CONFIG;
}
```

- [ ] **Step 12: Run all resolve tests**

```bash
cd ~/lorebook && bun test test/resolve.test.ts
```

Expected: all tests PASS.

- [ ] **Step 13: Typecheck**

```bash
cd ~/lorebook && bun run typecheck
```

Expected: no errors.

- [ ] **Step 14: Commit**

```bash
cd ~/lorebook
git add src/resolve.ts test/resolve.test.ts test/fixtures/
git commit -m "feat: entry resolution with frontmatter parsing and config loading"
```

---

### Task 4: Injection Formatting

**Files:**
- Create: `src/inject.ts`
- Create: `test/inject.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/inject.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { buildInjection, type InjectionEntry } from '../src/inject';
import type { LorebookEntry, LorebookConfig } from '../src/resolve';

function makeEntry(overrides: Partial<LorebookEntry> & { name: string; content: string }): LorebookEntry {
  return {
    keys: [],
    excludeKeys: [],
    priority: 0,
    enabled: true,
    description: '',
    source: 'project',
    ...overrides,
  };
}

function makeInjection(name: string, content: string, priority: number, matchedKeys: string[]): InjectionEntry {
  return {
    entry: makeEntry({ name, content, priority }),
    matchedKeys,
  };
}

const DEFAULT_CONFIG: LorebookConfig = { maxEntries: 5, maxChars: 4000 };

describe('buildInjection', () => {
  test('wraps single entry in XML', () => {
    const entries = [makeInjection('git-policy', 'Never force push.', 10, ['git'])];
    const result = buildInjection(entries, DEFAULT_CONFIG);
    expect(result).toBe(
      '<lorebook-context>\n<entry name="git-policy" keywords="git">\nNever force push.\n</entry>\n</lorebook-context>'
    );
  });

  test('sorts by priority descending', () => {
    const entries = [
      makeInjection('low', 'Low priority.', 1, ['low']),
      makeInjection('high', 'High priority.', 10, ['high']),
      makeInjection('mid', 'Mid priority.', 5, ['mid']),
    ];
    const result = buildInjection(entries, DEFAULT_CONFIG);
    const names = [...result.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(['high', 'mid', 'low']);
  });

  test('sorts alphabetically on priority tie', () => {
    const entries = [
      makeInjection('zebra', 'Z content.', 5, ['z']),
      makeInjection('alpha', 'A content.', 5, ['a']),
    ];
    const result = buildInjection(entries, DEFAULT_CONFIG);
    const names = [...result.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(['alpha', 'zebra']);
  });

  test('respects entry cap', () => {
    const config: LorebookConfig = { maxEntries: 2, maxChars: 99999 };
    const entries = [
      makeInjection('a', 'A.', 3, ['a']),
      makeInjection('b', 'B.', 2, ['b']),
      makeInjection('c', 'C.', 1, ['c']),
    ];
    const result = buildInjection(entries, config);
    const names = [...result.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(['a', 'b']);
  });

  test('respects character cap — skips entries that exceed, does not truncate', () => {
    const config: LorebookConfig = { maxEntries: 99, maxChars: 20 };
    const entries = [
      makeInjection('short', 'Hi.', 10, ['s']),         // 3 chars — fits
      makeInjection('long', 'A'.repeat(25), 9, ['l']),   // 25 chars — skip
      makeInjection('also-short', 'Yo.', 8, ['a']),      // 3 chars — fits
    ];
    const result = buildInjection(entries, config);
    const names = [...result.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(['short', 'also-short']);
  });

  test('character cap measures body only, not XML overhead', () => {
    const config: LorebookConfig = { maxEntries: 99, maxChars: 10 };
    const entries = [makeInjection('x', 'A'.repeat(10), 1, ['x'])];
    const result = buildInjection(entries, config);
    expect(result).toContain('name="x"'); // 10 chars exactly = fits
  });

  test('both caps — whichever hits first', () => {
    const config: LorebookConfig = { maxEntries: 1, maxChars: 99999 };
    const entries = [
      makeInjection('a', 'A.', 2, ['a']),
      makeInjection('b', 'B.', 1, ['b']),
    ];
    const result = buildInjection(entries, config);
    const names = [...result.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toEqual(['a']); // entry cap = 1
  });

  test('returns empty string when no entries', () => {
    expect(buildInjection([], DEFAULT_CONFIG)).toBe('');
  });

  test('includes matched keywords in attributes', () => {
    const entries = [makeInjection('test', 'Content.', 1, ['git', 'push'])];
    const result = buildInjection(entries, DEFAULT_CONFIG);
    expect(result).toContain('keywords="git, push"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/lorebook && bun test test/inject.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement buildInjection**

Create `src/inject.ts`:

```typescript
import type { LorebookEntry, LorebookConfig } from './resolve';

export interface InjectionEntry {
  entry: LorebookEntry;
  matchedKeys: string[];
}

export function buildInjection(entries: InjectionEntry[], config: LorebookConfig): string {
  const sorted = [...entries].sort((a, b) => {
    if (b.entry.priority !== a.entry.priority) return b.entry.priority - a.entry.priority;
    return a.entry.name.localeCompare(b.entry.name);
  });

  const selected: InjectionEntry[] = [];
  let totalChars = 0;

  for (const entry of sorted) {
    if (selected.length >= config.maxEntries) break;
    const charCount = entry.entry.content.length;
    if (totalChars + charCount > config.maxChars) continue;
    selected.push(entry);
    totalChars += charCount;
  }

  if (selected.length === 0) return '';

  const inner = selected
    .map(
      (e) =>
        `<entry name="${e.entry.name}" keywords="${e.matchedKeys.join(', ')}">\n${e.entry.content}\n</entry>`
    )
    .join('\n');

  return `<lorebook-context>\n${inner}\n</lorebook-context>`;
}
```

- [ ] **Step 4: Run all tests**

```bash
cd ~/lorebook && bun test test/inject.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Typecheck**

```bash
cd ~/lorebook && bun run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd ~/lorebook
git add src/inject.ts test/inject.test.ts
git commit -m "feat: injection formatting with priority sorting and cap enforcement"
```

---

### Task 5: CLI — match Command

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Write the full CLI entry point with match command**

Replace `src/index.ts` with:

```typescript
import { matchEntry } from './match';
import { resolveEntries, loadConfig } from './resolve';
import { buildInjection, type InjectionEntry } from './inject';

const command = process.argv[2];

switch (command) {
  case 'match':
    await handleMatch();
    break;
  case 'test':
    await handleTest(process.argv[3]);
    break;
  case 'list':
    await handleList();
    break;
  default:
    console.error('Usage: lorebook <match|test|list>');
    process.exit(1);
}

function runMatch(prompt: string, cwd: string): { matches: InjectionEntry[]; injection: string; totalEntries: number } {
  const entries = resolveEntries(cwd);
  const config = loadConfig(cwd);

  const matches: InjectionEntry[] = [];
  for (const entry of entries) {
    const result = matchEntry(prompt, entry);
    if (result) {
      matches.push({ entry, matchedKeys: result.matchedKeys });
    }
  }

  const injection = buildInjection(matches, config);
  return { matches, injection, totalEntries: entries.length };
}

async function handleMatch(): Promise<void> {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of Bun.stdin.stream()) {
      chunks.push(Buffer.from(chunk));
    }
    const input = Buffer.concat(chunks).toString('utf-8');
    const { prompt, cwd } = JSON.parse(input);

    if (typeof prompt !== 'string' || typeof cwd !== 'string') {
      console.log('{}');
      return;
    }

    const { injection } = runMatch(prompt, cwd);

    if (injection) {
      console.log(JSON.stringify({ additionalContext: injection }));
    } else {
      console.log('{}');
    }
  } catch {
    // Fail safe — never break the user's prompt
    console.log('{}');
  }
}

async function handleTest(prompt?: string): Promise<void> {
  // Implemented in Task 6
  console.error('Not implemented yet');
  process.exit(1);
}

async function handleList(): Promise<void> {
  // Implemented in Task 6
  console.error('Not implemented yet');
  process.exit(1);
}
```

- [ ] **Step 2: Verify the match command works end-to-end**

```bash
cd ~/lorebook
echo '{"prompt":"fix the git issue","cwd":"'$(pwd)'"}' | bun run src/index.ts match
```

Expected: `{}` (no lorebook directory exists yet — correct empty response).

- [ ] **Step 3: Test with a real lorebook entry**

```bash
cd ~/lorebook
mkdir -p .claude/lorebook
cat > .claude/lorebook/git-policy.md << 'EOF'
---
keys: [git, commit, push]
priority: 10
description: Git policy
---

Never force push. Use merge, not rebase.
EOF
echo '{"prompt":"fix the git issue","cwd":"'$(pwd)'"}' | bun run src/index.ts match
```

Expected: JSON output with `additionalContext` containing the git-policy entry.

- [ ] **Step 4: Clean up test lorebook and verify empty response**

```bash
cd ~/lorebook && rm -rf .claude/lorebook
echo '{"prompt":"fix the git issue","cwd":"'$(pwd)'"}' | bun run src/index.ts match
```

Expected: `{}`

- [ ] **Step 5: Typecheck**

```bash
cd ~/lorebook && bun run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd ~/lorebook
git add src/index.ts
git commit -m "feat: CLI entry point with match command"
```

---

### Task 6: CLI — test and list Commands

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Implement handleTest**

Replace the `handleTest` placeholder in `src/index.ts`:

```typescript
async function handleTest(prompt?: string): Promise<void> {
  if (!prompt) {
    console.error('Usage: lorebook test "<prompt text>"');
    process.exit(1);
  }

  const cwd = process.cwd();
  const entries = resolveEntries(cwd);
  const config = loadConfig(cwd);

  const matches: InjectionEntry[] = [];
  for (const entry of entries) {
    const result = matchEntry(prompt, entry);
    if (result) {
      matches.push({ entry, matchedKeys: result.matchedKeys });
    }
  }

  const injection = buildInjection(matches, config);

  if (matches.length === 0) {
    console.log(`No matches out of ${entries.length} entries.`);
    return;
  }

  console.log(`Matched ${matches.length} of ${entries.length} entries:\n`);

  // Sort same as injection for display
  const sorted = [...matches].sort((a, b) => {
    if (b.entry.priority !== a.entry.priority) return b.entry.priority - a.entry.priority;
    return a.entry.name.localeCompare(b.entry.name);
  });

  for (const m of sorted) {
    console.log(`  ${m.entry.name} (priority: ${m.entry.priority})`);
    console.log(`    matched: ${m.matchedKeys.join(', ')}`);
    console.log(`    excluded: \u2014`);
    console.log('');
  }

  const charCount = matches.reduce((sum, m) => sum + m.entry.content.length, 0);
  console.log(`Injection preview (${charCount} chars, ${matches.length}/${config.maxEntries} entries):`);
  console.log('\u2500'.repeat(42));
  console.log(injection);
}
```

- [ ] **Step 2: Implement handleList**

Replace the `handleList` placeholder in `src/index.ts`:

```typescript
async function handleList(): Promise<void> {
  const cwd = process.cwd();
  const entries = resolveEntries(cwd);

  const projectEntries = entries.filter((e) => e.source === 'project');
  const globalEntries = entries.filter((e) => e.source === 'global');

  if (entries.length === 0) {
    console.log('No lorebook entries found.');
    console.log(`Searched: ${cwd}/.claude/lorebook/ and ~/.claude/lorebook/`);
    return;
  }

  function printEntries(label: string, items: typeof entries): void {
    if (items.length === 0) return;
    console.log(`${label}:`);
    for (const e of items) {
      const status = e.enabled ? 'enabled' : 'disabled';
      const keys = e.keys.join(',');
      console.log(`  ${e.name}.md\tpriority:${e.priority}\tkeys:[${keys}]\t${status}`);
    }
    console.log('');
  }

  printEntries(`Project (${cwd}/.claude/lorebook/)`, projectEntries);
  printEntries('Global (~/.claude/lorebook/)', globalEntries);

  const enabled = entries.filter((e) => e.enabled).length;
  const disabled = entries.length - enabled;
  console.log(`${entries.length} entries (${enabled} enabled, ${disabled} disabled)`);
}
```

- [ ] **Step 3: Test the list command**

```bash
cd ~/lorebook
mkdir -p .claude/lorebook
cat > .claude/lorebook/example.md << 'EOF'
---
keys: [example, demo]
priority: 5
description: Example entry
---

This is an example lorebook entry.
EOF
bun run src/index.ts list
```

Expected: shows the example entry with keys, priority, and enabled status.

- [ ] **Step 4: Test the test command**

```bash
cd ~/lorebook
bun run src/index.ts test "show me the example"
```

Expected: shows matched entry with injection preview.

- [ ] **Step 5: Test with no matches**

```bash
cd ~/lorebook
bun run src/index.ts test "nothing should match this xyz"
```

Expected: "No matches out of 1 entries."

- [ ] **Step 6: Clean up test fixture, typecheck**

```bash
cd ~/lorebook && rm -rf .claude/lorebook
bun run typecheck
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd ~/lorebook && bun test
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
cd ~/lorebook
git add src/index.ts
git commit -m "feat: CLI test and list commands"
```

---

### Task 7: Install Script

**Files:**
- Create: `install.sh`

- [ ] **Step 1: Write the install script**

Create `install.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="OWNER/lorebook"
INSTALL_DIR="${HOME}/.local/bin"
CLAUDE_DIR="${HOME}/.claude"
LOREBOOK_DIR="${CLAUDE_DIR}/lorebook"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}${BOLD}==>${NC} ${BOLD}$1${NC}"; }
warn()  { echo -e "${YELLOW}warning:${NC} $1"; }
error() { echo -e "${RED}error:${NC} $1" >&2; exit 1; }

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Linux*)  PLATFORM="linux" ;;
  Darwin*) PLATFORM="darwin" ;;
  *)       error "Unsupported OS: $OS" ;;
esac

# Detect arch
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64) ARCH="arm64" ;;
  arm64)   ARCH="arm64" ;;
  *)       error "Unsupported architecture: $ARCH" ;;
esac

BINARY="lorebook-${PLATFORM}-${ARCH}"
info "Detected platform: ${PLATFORM}-${ARCH}"

# Download binary
LATEST=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
if [ -z "$LATEST" ]; then
  error "Could not determine latest release"
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST}/${BINARY}"
info "Downloading lorebook ${LATEST}..."

mkdir -p "$INSTALL_DIR"
curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/lorebook"
chmod +x "${INSTALL_DIR}/lorebook"

info "Installed to ${INSTALL_DIR}/lorebook"

# Check PATH
if ! echo "$PATH" | tr ':' '\n' | grep -q "^${INSTALL_DIR}$"; then
  warn "${INSTALL_DIR} is not in your PATH"
  warn "Add this to your shell profile: export PATH=\"${INSTALL_DIR}:\$PATH\""
fi

# Detect and configure Claude Code
if [ -d "$CLAUDE_DIR" ]; then
  info "Claude Code detected — configuring hook..."

  SETTINGS_FILE="${CLAUDE_DIR}/settings.json"

  HOOK_ENTRY='{"type":"command","command":"lorebook match"}'
  HOOK_GROUP="{\"hooks\":[${HOOK_ENTRY}]}"

  if [ -f "$SETTINGS_FILE" ]; then
    # Check if lorebook hook already exists
    if grep -q "lorebook match" "$SETTINGS_FILE" 2>/dev/null; then
      info "Hook already configured — skipping"
    else
      # Merge hook into existing settings using a temp file
      TEMP=$(mktemp)
      # Use python/node/bun to safely merge JSON — pick whichever is available
      if command -v python3 &>/dev/null; then
        python3 -c "
import json, sys
with open('${SETTINGS_FILE}') as f:
    settings = json.load(f)
hooks = settings.setdefault('hooks', {})
ups = hooks.setdefault('UserPromptSubmit', [])
ups.append(json.loads('${HOOK_GROUP}'))
with open('${TEMP}', 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')
"
        mv "$TEMP" "$SETTINGS_FILE"
        info "Added UserPromptSubmit hook to ${SETTINGS_FILE}"
      else
        warn "Could not find python3 to merge settings — add hook manually"
        warn "See: https://github.com/${REPO}#manual-setup"
      fi
    fi
  else
    # Create settings file with hook
    cat > "$SETTINGS_FILE" << SETTINGS_EOF
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
SETTINGS_EOF
    info "Created ${SETTINGS_FILE} with lorebook hook"
  fi

  # Create lorebook directory with example entry
  if [ ! -d "$LOREBOOK_DIR" ]; then
    mkdir -p "$LOREBOOK_DIR"
    cat > "${LOREBOOK_DIR}/example.md" << 'EXAMPLE_EOF'
---
keys: [example, demo]
priority: 0
enabled: false
description: Example lorebook entry — enable and customize this, or delete it and create your own
---

This is an example lorebook entry. When enabled, it injects this content into your prompt whenever you mention "example" or "demo".

Create your own entries as .md files in this directory with YAML frontmatter containing keys, priority, and other fields. See https://github.com/OWNER/lorebook for documentation.
EXAMPLE_EOF
    info "Created ${LOREBOOK_DIR}/ with example entry"
  else
    info "Lorebook directory already exists — skipping"
  fi
else
  warn "Claude Code not detected (~/.claude/ not found)"
  warn "Install Claude Code first, then re-run this script to configure the hook"
fi

echo ""
info "lorebook ${LATEST} installed successfully!"
echo ""
echo "  Next steps:"
echo "    1. Create entries in ~/.claude/lorebook/ or .claude/lorebook/"
echo "    2. Test with: lorebook test \"your prompt here\""
echo "    3. See all entries: lorebook list"
echo ""
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x ~/lorebook/install.sh
```

- [ ] **Step 3: Review the script for correctness**

Run shellcheck if available:

```bash
shellcheck ~/lorebook/install.sh || true
```

Fix any issues found.

- [ ] **Step 4: Commit**

```bash
cd ~/lorebook
git add install.sh
git commit -m "feat: install script with Claude Code auto-detection and hook wiring"
```

---

### Task 8: CI/CD — GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install

      - run: bun run typecheck

      - run: bun test
```

- [ ] **Step 2: Create release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - target: bun-linux-x64
            binary: lorebook-linux-x64
          - target: bun-linux-arm64
            binary: lorebook-linux-arm64
          - target: bun-darwin-x64
            binary: lorebook-darwin-x64
          - target: bun-darwin-arm64
            binary: lorebook-darwin-arm64

    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install

      - run: bun build --compile --target=${{ matrix.target }} src/index.ts --outfile ${{ matrix.binary }}

      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.binary }}
          path: ${{ matrix.binary }}

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          path: dist/
          merge-multiple: true

      - uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/lorebook-*
            install.sh
          generate_release_notes: true
```

- [ ] **Step 3: Commit**

```bash
cd ~/lorebook
git add .github/
git commit -m "ci: GitHub Actions for tests and cross-platform releases"
```

---

### Task 9: Documentation

**Files:**
- Create: `README.md`
- Create: `CLAUDE.md`
- Create: `LICENSE`

- [ ] **Step 1: Create LICENSE (MIT)**

Create `LICENSE`:

```
MIT License

Copyright (c) 2026 lorebook contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Create README.md**

Create `README.md`:

````markdown
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
````

- [ ] **Step 3: Create CLAUDE.md**

Create `CLAUDE.md`:

```markdown
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
```

- [ ] **Step 4: Commit**

```bash
cd ~/lorebook
git add LICENSE README.md CLAUDE.md
git commit -m "docs: README, CLAUDE.md, and MIT license"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd ~/lorebook && bun test
```

Expected: all tests PASS.

- [ ] **Step 2: Run typecheck**

```bash
cd ~/lorebook && bun run typecheck
```

Expected: no errors.

- [ ] **Step 3: Test compilation**

```bash
cd ~/lorebook && bun run build
```

Expected: produces `lorebook` binary in project root.

- [ ] **Step 4: Test compiled binary**

```bash
cd ~/lorebook
mkdir -p .claude/lorebook
cat > .claude/lorebook/test-entry.md << 'EOF'
---
keys: [hello, world]
priority: 1
description: Test entry
---

Hello world content.
EOF

# Test match
echo '{"prompt":"hello there","cwd":"'$(pwd)'"}' | ./lorebook match

# Test list
./lorebook list

# Test test
./lorebook test "hello world"

# Clean up
rm -rf .claude/lorebook
```

Expected: match returns JSON with additionalContext, list shows the entry, test shows match preview.

- [ ] **Step 5: Verify fail-safe behavior**

```bash
cd ~/lorebook
echo 'invalid json' | ./lorebook match
echo $?
```

Expected: outputs `{}`, exit code 0.

- [ ] **Step 6: Commit any final fixes if needed**

If any verification steps required fixes, commit them.

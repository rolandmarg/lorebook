import { describe, test, expect } from 'bun:test';
import { join } from 'path';
import { parseEntry } from '../src/resolve';

const FIXTURES = join(import.meta.dir, 'fixtures');

describe('parseEntry', () => {
  test('parses all frontmatter fields', () => {
    const entry = parseEntry(join(FIXTURES, 'git-policy.md'), 'project', '.claude/lorebook/git-policy.md');
    expect(entry.name).toBe('git-policy');
    expect(entry.keys).toEqual(['git', 'commit', 'push', 'rebase']);
    expect(entry.excludeKeys).toEqual(['github', 'gitignore']);
    expect(entry.priority).toBe(10);
    expect(entry.enabled).toBe(true);
    expect(entry.description).toBe('Git policy rules');
    expect(entry.content).toBe('Never force push. Use merge, not rebase.');
    expect(entry.source).toBe('project');
    expect(entry.filePath).toBe('.claude/lorebook/git-policy.md');
  });

  test('applies defaults for optional fields', () => {
    const entry = parseEntry(join(FIXTURES, 'minimal.md'), 'global', '~/.claude/lorebook/minimal.md');
    expect(entry.excludeKeys).toEqual([]);
    expect(entry.priority).toBe(0);
    expect(entry.enabled).toBe(true);
    expect(entry.description).toBe('');
    expect(entry.source).toBe('global');
    expect(entry.filePath).toBe('~/.claude/lorebook/minimal.md');
  });

  test('parses disabled entries', () => {
    const entry = parseEntry(join(FIXTURES, 'disabled-entry.md'), 'project', '.claude/lorebook/disabled-entry.md');
    expect(entry.enabled).toBe(false);
  });

  test('parses inject_files from frontmatter', () => {
    const entry = parseEntry(join(FIXTURES, 'with-inject-files.md'), 'project', '.claude/lorebook/with-inject-files.md');
    expect(entry.injectFiles).toEqual(['PHILOSOPHY.md', 'IDEAS.md']);
  });

  test('defaults injectFiles to empty array', () => {
    const entry = parseEntry(join(FIXTURES, 'minimal.md'), 'global', '~/.claude/lorebook/minimal.md');
    expect(entry.injectFiles).toEqual([]);
  });
});

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
    expect(config.maxChars).toBe(4000);
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

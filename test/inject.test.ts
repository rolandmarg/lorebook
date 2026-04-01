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

import { describe, test, expect } from 'bun:test';
import { logInvocation } from '../src/log';
import type { InjectionEntry } from '../src/inject';
import type { LorebookEntry } from '../src/resolve';
import { mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function makeMatch(name: string, filePath: string, matchedKeys: string[]): InjectionEntry {
  return {
    entry: {
      name,
      keys: matchedKeys,
      excludeKeys: [],
      priority: 0,
      enabled: true,
      description: '',
      content: 'test content',
      injectFiles: [],
      source: 'project',
      filePath,
    } satisfies LorebookEntry,
    matchedKeys,
  };
}

describe('logInvocation', () => {
  test('appends JSONL line to log file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lorebook-log-'));
    const logPath = join(tmp, 'lorebook.log');

    logInvocation('tell me about git', [makeMatch('git-policy', '.claude/lorebook/git-policy.md', ['git'])], logPath);

    const content = readFileSync(logPath, 'utf-8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.prompt).toBe('tell me about git');
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].name).toBe('git-policy');
    expect(parsed.entries[0].source).toBe('.claude/lorebook/git-policy.md');
    expect(parsed.entries[0].keywords).toEqual(['git']);
  });

  test('appends multiple invocations as separate lines', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lorebook-log-'));
    const logPath = join(tmp, 'lorebook.log');

    logInvocation('prompt one', [makeMatch('a', '.claude/lorebook/a.md', ['alpha'])], logPath);
    logInvocation('prompt two', [makeMatch('b', '~/.claude/lorebook/b.md', ['beta'])], logPath);

    const lines = readFileSync(logPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).prompt).toBe('prompt one');
    expect(JSON.parse(lines[1]!).prompt).toBe('prompt two');
  });

  test('logs multiple matched entries in a single invocation', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'lorebook-log-'));
    const logPath = join(tmp, 'lorebook.log');

    logInvocation(
      'git push to gpu',
      [
        makeMatch('git-policy', '.claude/lorebook/git-policy.md', ['git', 'push']),
        makeMatch('gpu-transfers', '~/.claude/lorebook/gpu-transfers.md', ['gpu']),
      ],
      logPath
    );

    const parsed = JSON.parse(readFileSync(logPath, 'utf-8').trim());
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0].name).toBe('git-policy');
    expect(parsed.entries[1].name).toBe('gpu-transfers');
  });

  test('does not throw on write failure', () => {
    // Attempt to write to an invalid path — should silently fail
    expect(() => logInvocation('test', [makeMatch('a', 'a.md', ['x'])], '/dev/null/impossible/path.log')).not.toThrow();
  });
});

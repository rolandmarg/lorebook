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

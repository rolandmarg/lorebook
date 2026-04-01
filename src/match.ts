function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

export function matchKeywords(prompt: string, keywords: string[]): string[] {
  return keywords.filter((kw) => keywordRegex(kw).test(prompt));
}

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

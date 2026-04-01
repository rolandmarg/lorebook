import { appendFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { InjectionEntry } from './inject';

export function logInvocation(prompt: string, matches: InjectionEntry[], logPath?: string): void {
  try {
    const filePath = logPath ?? join(homedir(), '.claude', 'lorebook', 'lorebook.log');
    mkdirSync(dirname(filePath), { recursive: true });
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      prompt,
      entries: matches.map((m) => ({
        name: m.entry.name,
        source: m.entry.filePath,
        keywords: m.matchedKeys,
      })),
    });
    appendFileSync(filePath, line + '\n');
  } catch {
    // Fire-and-forget — never break the hook
  }
}

import type { LorebookEntry, LorebookConfig } from './resolve';

export interface InjectionEntry {
  entry: LorebookEntry;
  matchedKeys: string[];
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        `<entry name="${escapeXml(e.entry.name)}" keywords="${escapeXml(e.matchedKeys.join(', '))}">\n${e.entry.content}\n</entry>`
    )
    .join('\n');

  return `<lorebook-context>\n${inner}\n</lorebook-context>`;
}

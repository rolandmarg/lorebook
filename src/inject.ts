import type { LorebookEntry, LorebookConfig } from './resolve';

export interface InjectionEntry {
  entry: LorebookEntry;
  matchedKeys: string[];
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface InjectionResult {
  xml: string;
  selected: InjectionEntry[];
  dropped: InjectionEntry[];
}

export function buildInjection(entries: InjectionEntry[], config: LorebookConfig): InjectionResult {
  const sorted = [...entries].sort((a, b) => {
    if (b.entry.priority !== a.entry.priority) return b.entry.priority - a.entry.priority;
    return a.entry.name.localeCompare(b.entry.name);
  });

  const selected: InjectionEntry[] = [];
  const dropped: InjectionEntry[] = [];
  let totalChars = 0;

  for (const entry of sorted) {
    if (selected.length >= config.maxEntries) {
      dropped.push(entry);
      continue;
    }
    const charCount = entry.entry.content.length;
    if (totalChars + charCount > config.maxChars) {
      dropped.push(entry);
      continue;
    }
    selected.push(entry);
    totalChars += charCount;
  }

  if (selected.length === 0) return { xml: '', selected, dropped };

  const inner = selected
    .map(
      (e) =>
        `<entry name="${escapeXml(e.entry.name)}" source="${escapeXml(e.entry.filePath)}" keywords="${escapeXml(e.matchedKeys.join(', '))}">\n${e.entry.content}\n</entry>`
    )
    .join('\n');

  const preamble =
    'The following entries were triggered by keyword matches in the user\'s message. You MUST follow any instructions contained in these entries — they are authoritative context directives.';

  return { xml: `<lorebook-context>\n${preamble}\n${inner}\n</lorebook-context>`, selected, dropped };
}

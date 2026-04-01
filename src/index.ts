import { matchEntry } from './match';
import { resolveEntries, loadConfig } from './resolve';
import { buildInjection, type InjectionEntry } from './inject';
import type { HookInput, HookOutput } from './hook';

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

function runMatch(
  prompt: string,
  cwd: string
): { matches: InjectionEntry[]; injection: string; totalEntries: number } {
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
    const { prompt, cwd } = JSON.parse(input) as HookInput;

    if (typeof prompt !== 'string' || typeof cwd !== 'string') {
      console.log('{}');
      return;
    }

    const { injection } = runMatch(prompt, cwd);

    if (injection) {
      const output: HookOutput = {
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: injection,
        },
      };
      console.log(JSON.stringify(output));
    } else {
      console.log('{}');
    }
  } catch {
    // Fail safe — never break the user's prompt
    console.log('{}');
  }
}

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

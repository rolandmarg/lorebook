import { matchEntry } from './match';
import { resolveEntries, loadConfig } from './resolve';
import { buildInjection, type InjectionEntry } from './inject';
import { logInvocation } from './log';
import type { HookInput, HookOutput } from './hook';

const VERSION = '0.2.1';

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
  case 'update':
    await handleUpdate();
    break;
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  case 'version':
  case '--version':
  case '-v':
    console.log(`lorebook ${VERSION}`);
    break;
  default:
    printHelp();
    process.exit(command ? 1 : 0);
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

    const { matches, injection } = runMatch(prompt, cwd);

    for (const m of matches) {
      process.stderr.write(`[lorebook] ${m.entry.filePath} (keys: ${m.matchedKeys.join(', ')})\n`);
    }

    if (matches.length > 0) {
      logInvocation(prompt, matches);
    }

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

async function handleUpdate(): Promise<void> {
  const REPO = 'rolandmarg/lorebook';

  const os = (await import('os')).default;
  const path = (await import('path')).default;
  const fs = (await import('fs')).default;
  const { execFileSync } = await import('child_process');

  const platform = process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const binaryName = `lorebook-${platform}-${arch}`;

  console.log(`Checking for updates...`);

  let latest: string;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const data = (await res.json()) as { tag_name: string };
    latest = data.tag_name;
  } catch (e) {
    console.error(`Failed to check for updates: ${e}`);
    process.exit(1);
  }

  const latestVersion = latest.replace(/^v/, '');
  if (latestVersion === VERSION) {
    console.log(`Already up to date (${VERSION}).`);
    return;
  }

  console.log(`Updating ${VERSION} -> ${latestVersion}...`);

  const baseUrl = `https://github.com/${REPO}/releases/download/${latest}`;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lorebook-update-'));
  const tmpBinary = path.join(tmpDir, 'lorebook');
  const tmpSums = path.join(tmpDir, 'SHA256SUMS');

  try {
    const [binRes, sumRes] = await Promise.all([
      fetch(`${baseUrl}/${binaryName}`),
      fetch(`${baseUrl}/SHA256SUMS`),
    ]);

    if (!binRes.ok) throw new Error(`Failed to download binary: ${binRes.status}`);
    if (!sumRes.ok) throw new Error(`Failed to download checksums: ${sumRes.status}`);

    fs.writeFileSync(tmpBinary, Buffer.from(await binRes.arrayBuffer()));
    fs.writeFileSync(tmpSums, await sumRes.text());

    // Verify checksum
    const sums = fs.readFileSync(tmpSums, 'utf-8');
    const expectedLine = sums.split('\n').find((l: string) => l.includes(binaryName));
    if (!expectedLine) throw new Error(`No checksum found for ${binaryName}`);
    const expected = expectedLine.split(/\s+/)[0];

    const actual = execFileSync('sha256sum', [tmpBinary]).toString().split(/\s+/)[0];
    if (expected !== actual) throw new Error('Checksum verification failed');

    // Replace binary
    const installDir = path.join(os.homedir(), '.local', 'bin');
    fs.mkdirSync(installDir, { recursive: true });
    const dest = path.join(installDir, 'lorebook');
    fs.copyFileSync(tmpBinary, dest);
    fs.chmodSync(dest, 0o755);

    console.log(`Updated to ${latestVersion} (checksum verified).`);
  } catch (e) {
    console.error(`Update failed: ${e}`);
    process.exit(1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function printHelp(): void {
  console.log(`lorebook ${VERSION} — keyword-triggered context injection for AI coding agents

Usage: lorebook <command>

Commands:
  test "<prompt>"   Show which entries match a prompt
  list              List all entries and their status
  match             Hook mode — reads JSON from stdin, outputs injection (used by Claude Code hook)
  update            Update to the latest release
  help              Show this help

Options:
  --help, -h        Show this help
  --version, -v     Show version

Entry format:
  Markdown files with YAML frontmatter in:
    .claude/lorebook/      (project, higher priority)
    ~/.claude/lorebook/    (global)

  Frontmatter fields:
    keys: [word, ...]       Required. Triggers on ANY keyword match.
    exclude_keys: [...]     Suppresses if ANY match.
    priority: <number>      Higher = injected first. Default: 0
    enabled: <boolean>      Default: true

Config:
  lorebook.json in .claude/lorebook/ or .claude/ (project or global):
    { "maxEntries": 5, "maxChars": 4000 }

https://github.com/rolandmarg/lorebook`);
}

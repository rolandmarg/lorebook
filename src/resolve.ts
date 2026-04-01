import matter from 'gray-matter';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { basename, join } from 'path';
import { homedir } from 'os';

export interface LorebookEntry {
  name: string;
  keys: string[];
  excludeKeys: string[];
  priority: number;
  enabled: boolean;
  description: string;
  content: string;
  injectFiles: string[];
  source: 'project' | 'global';
  filePath: string;
}

export function parseEntry(filePath: string, source: 'project' | 'global', displayPath: string): LorebookEntry {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    name: basename(filePath, '.md'),
    keys: Array.isArray(data.keys) ? data.keys.map(String) : [],
    excludeKeys: Array.isArray(data.exclude_keys) ? data.exclude_keys.map(String) : [],
    priority: typeof data.priority === 'number' ? data.priority : 0,
    enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
    description: typeof data.description === 'string' ? data.description : '',
    content: content.trim(),
    injectFiles: Array.isArray(data.inject_files) ? data.inject_files.map(String) : [],
    source,
    filePath: displayPath,
  };
}

function loadEntriesFromDir(dir: string, source: 'project' | 'global', displayPrefix: string): LorebookEntry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseEntry(join(dir, f), source, join(displayPrefix, f)));
}

export function resolveEntries(cwd: string, globalBase?: string): LorebookEntry[] {
  const projectDir = join(cwd, '.claude', 'lorebook');
  const globalDir = join(globalBase ?? homedir(), '.claude', 'lorebook');

  const projectEntries = loadEntriesFromDir(projectDir, 'project', '.claude/lorebook');
  const globalEntries = loadEntriesFromDir(globalDir, 'global', '~/.claude/lorebook');

  const projectNames = new Set(projectEntries.map((e) => e.name));
  return [...projectEntries, ...globalEntries.filter((e) => !projectNames.has(e.name))];
}

export interface LorebookConfig {
  maxEntries: number;
  maxChars: number;
}

const DEFAULT_CONFIG: LorebookConfig = { maxEntries: 5, maxChars: 4000 };

export function loadConfig(cwd: string, globalBase?: string): LorebookConfig {
  const home = globalBase ?? homedir();
  const candidates = [
    join(cwd, '.claude', 'lorebook', 'lorebook.json'),
    join(cwd, '.claude', 'lorebook.json'),
    join(home, '.claude', 'lorebook', 'lorebook.json'),
    join(home, '.claude', 'lorebook.json'),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      const raw = JSON.parse(readFileSync(path, 'utf-8'));
      return {
        maxEntries: typeof raw.maxEntries === 'number' ? raw.maxEntries : DEFAULT_CONFIG.maxEntries,
        maxChars: typeof raw.maxChars === 'number' ? raw.maxChars : DEFAULT_CONFIG.maxChars,
      };
    }
  }

  return DEFAULT_CONFIG;
}

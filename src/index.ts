const command = process.argv[2];

if (!command || !['match', 'test', 'list'].includes(command)) {
  console.error('Usage: lorebook <match|test|list>');
  process.exit(1);
}

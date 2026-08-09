#!/usr/bin/env node

const commands = ['init', 'check', 'fix', 'mcp'];

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(`de-slop — anti AI-slop toolkit

Usage: de-slop <command>

Commands:
  init    Inisialisasi de-slop di proyek (rules, hooks, config)
  check   Scan kode untuk AI slop patterns
  fix     Perbaiki slop secara otomatis (jika memungkinkan)
  mcp     Jalankan MCP server untuk Cursor/Claude Code
`);
    process.exit(0);
  }

  if (!commands.includes(cmd)) {
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
  }

  const mod = await import(`../src/commands/${cmd}.js`);
  await mod.default(args);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

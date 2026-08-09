#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COMMANDS = ['init', 'check', 'fix', 'mcp', 'intercept'];

function cliVersion() {
  const packageJson = fileURLToPath(new URL('../package.json', import.meta.url));
  return JSON.parse(readFileSync(packageJson, 'utf8')).version;
}

const GLOBAL_HELP = `de-slop — anti AI-slop toolkit (v${cliVersion()})

Usage: de-slop <command> [options]

Commands:
  init    Inisialisasi de-slop di proyek (config, store, pre-commit hook)
  check   Scan kode untuk AI slop patterns
  fix     Perbaiki slop secara otomatis (jika memungkinkan)
  mcp     Jalankan MCP server untuk Cursor/Claude Code
  intercept   Cek keamanan package sebelum install (anti slopsquatting)

Run 'de-slop <command> --help' for command-specific options.
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === '--version' || cmd === '-v') {
    console.log(cliVersion());
    return 0;
  }
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(GLOBAL_HELP);
    return 0;
  }
  if (!COMMANDS.includes(cmd)) {
    console.error(`de-slop: unknown command '${cmd}'. Run 'de-slop --help' for usage.`);
    return 1;
  }

  const mod = await import(`../src/commands/${cmd}.js`);
  if (rest.includes('--help') || rest.includes('-h')) {
    console.log(mod.help);
    return 0;
  }
  return (await mod.default(rest)) ?? 0;
}

main().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (err) => {
    console.error(`de-slop: ${err.message}`);
    process.exitCode = 1;
  }
);

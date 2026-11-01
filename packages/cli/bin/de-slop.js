#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COMMANDS = ['init', 'check', 'fix', 'mcp', 'intercept', 'report', 'prose', 'budget', 'context', 'rules'];

function cliVersion() {
  const packageJson = fileURLToPath(new URL('../package.json', import.meta.url));
  return JSON.parse(readFileSync(packageJson, 'utf8')).version;
}

const GLOBAL_HELP = `de-slop — anti AI-slop toolkit (v${cliVersion()})

Usage: de-slop <command> [options]

Commands:
  init       Set up de-slop in a project (config, store, pre-commit hook)
  check      Scan code, markup, and docs for AI slop patterns
  fix        Rewrite the fixable findings in place
  prose      Score documents for AI writing tells
  budget     Measure erosion and verbosity against a baseline
  context    Check agent instruction files against the repo
  rules      List every rule, or regenerate docs/RULES.md
  intercept  Check packages before install (anti slopsquatting)
  report     Run every guardrail and write REPORT.md + report.json
  mcp        Start the MCP server for Cursor and [CC]

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

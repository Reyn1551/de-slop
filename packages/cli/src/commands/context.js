import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectRepoFacts, scanContextRot } from '@de-slop/core';
import { parseArgs } from '../args.js';
import { findSourceFiles } from '../files.js';

export const help = `de-slop context — check agent instructions against the repo

Usage: de-slop context [paths...] [options]

Agent config files (AGENTS.md, CLAUDE.md, .cursorrules, .cursor/rules/*.md,
.github/copilot-instructions.md) go stale as code moves. Treude and Baltes
call this context rot and measured stale code references in 23% of sampled
repositories (arXiv:2606.09090).

This command builds the repo's real facts — file paths, exported symbols,
package.json scripts — then reports every reference an instruction file makes
that no longer resolves.

Options:
  --json   Print machine-readable JSON
  --help   Show this help

Exit code is 1 when a stale reference is found.
`;

const CONFIG_CANDIDATES = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursorrules',
  '.windsurfrules',
  '.clinerules',
  join('.github', 'copilot-instructions.md'),
];

function findAgentConfigs(root) {
  const found = [];
  for (const candidate of CONFIG_CANDIDATES) {
    const path = join(root, candidate);
    if (existsSync(path)) found.push(path);
  }

  const rulesDir = join(root, '.cursor', 'rules');
  if (existsSync(rulesDir)) {
    for (const filePath of findSourceFiles([rulesDir]).files) {
      if (/\.(?:md|mdc)$/i.test(filePath)) found.push(filePath);
    }
  }

  return found;
}

export default async function context(argv) {
  const { positional, options } = parseArgs(argv);
  const root = positional[0] ?? '.';

  const configs = findAgentConfigs(root);
  if (configs.length === 0) {
    console.log('de-slop context: no agent config files found');
    return 0;
  }

  const { files } = findSourceFiles([root]);
  const sources = [];
  for (const filePath of files) {
    try {
      sources.push({ filePath, code: readFileSync(filePath, 'utf8') });
    } catch {
      continue;
    }
  }

  const packageJson = sources.find((source) => source.filePath.endsWith('package.json'))?.code;
  const facts = collectRepoFacts(sources, packageJson);

  const results = [];
  let findings = 0;
  for (const filePath of configs) {
    const code = readFileSync(filePath, 'utf8');
    const diagnostics = scanContextRot(code, filePath, facts);
    findings += diagnostics.length;
    results.push({ filePath, diagnostics });
  }

  if (options.json) {
    console.log(JSON.stringify({ facts: { files: facts.files.length, symbols: facts.symbols.length, scripts: facts.scripts }, results }, null, 2));
    return findings > 0 ? 1 : 0;
  }

  console.log(
    `de-slop context: ${configs.length} instruction file(s) checked against ${facts.files.length} files, ${facts.symbols.length} symbols, ${facts.scripts.length} scripts`,
  );
  for (const result of results) {
    for (const diagnostic of result.diagnostics) {
      console.log(
        `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.message}`,
      );
    }
  }
  console.log(`${findings} stale reference(s) found`);
  return findings > 0 ? 1 : 0;
}

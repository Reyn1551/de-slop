import { readFileSync } from 'node:fs';
import { analyzeProse } from '@de-slop/core';
import { parseArgs } from '../args.js';
import { loadConfig } from '../config.js';
import { findSourceFiles } from '../files.js';

export const help = `de-slop prose — score documents for AI writing tells

Usage: de-slop prose [paths...] [options]

Scans Markdown and text documents for the patterns that mark machine copy:
not-X-but-Y contrasts, staged openers, chatbot residue, inflated
significance, AI vocabulary, dash overload, bold-label lists, and closers.

Each document gets a 0-100 score. A score of 25 or more is an error.

Options:
  --rules <a,b,c>  Only run the given rule ids (default: .desloprc prose)
  --min <score>    Only report documents at or above this score (default 0)
  --json           Print machine-readable JSON
  --help           Show this help

Exit code is 1 when any error-severity finding is reported.
`;

function splitRules(value) {
  return typeof value === 'string'
    ? value.split(',').map((part) => part.trim()).filter(Boolean)
    : undefined;
}

export default async function prose(argv) {
  const { positional, options } = parseArgs(argv);
  const config = loadConfig(process.cwd());
  const paths = positional.length > 0 ? positional : ['.'];
  const rules = splitRules(options.rules) ?? (config.prose.length > 0 ? config.prose : undefined);
  const minimum = Number(options.min ?? 0);

  const { files, missing } = findSourceFiles(paths);
  const docs = files.filter((filePath) => /\.(?:md|mdx|markdown|txt|rst|adoc)$/i.test(filePath));
  if (docs.length === 0) {
    if (missing.length > 0) {
      console.error(`de-slop: no matching files: ${missing.join(', ')}`);
      return 1;
    }
    console.log('de-slop prose: no documents found');
    return 0;
  }

  const results = [];
  let errors = 0;
  let warnings = 0;

  for (const filePath of docs) {
    const code = readFileSync(filePath, 'utf8');
    const { diagnostics, metrics } = analyzeProse(code, filePath, rules ? { rules } : {});
    if (metrics.score < minimum) continue;
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === 'error') errors += 1;
      else warnings += 1;
    }
    results.push({ filePath, metrics, diagnostics });
  }

  if (options.json) {
    console.log(JSON.stringify({ results, errors, warnings }, null, 2));
    return errors > 0 ? 1 : 0;
  }

  for (const result of results) {
    const { words, sentences, score } = result.metrics;
    console.log(`${result.filePath} — score ${score}/100 (${words} words, ${sentences} sentences)`);
    for (const diagnostic of result.diagnostics) {
      console.log(
        `  ${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.message}`,
      );
    }
  }

  console.log(`${results.length} documents scored, ${errors} errors, ${warnings} warnings`);
  return errors > 0 ? 1 : 0;
}

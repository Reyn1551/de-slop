import { readFileSync, writeFileSync } from 'node:fs';
import { applyFixes } from '@de-slop/core/slop-scanner';
import { parseArgs } from '../args.js';
import { findSourceFiles } from '../files.js';
import { scanFile } from '../scan.js';

export const help = `de-slop fix — auto-fix fixable slop issues

Usage: de-slop fix [paths...] [options]

Scans like 'check' but rewrites files whose diagnostics carry a fix.
Diagnostics without a fix are printed instead. Files with no source change
are left untouched.

Options:
  --rules <a,b,c>  Only run the given rule ids
  --help           Show this help

Exit code is 1 when error-severity diagnostics remain after fixing.
`;

function splitRules(value) {
  return typeof value === 'string'
    ? value.split(',').map((part) => part.trim()).filter(Boolean)
    : undefined;
}

export default async function fix(argv) {
  const { positional, options } = parseArgs(argv);
  const paths = positional.length > 0 ? positional : ['.'];
  const rules = splitRules(options.rules);

  const { files, missing } = findSourceFiles(paths);
  if (files.length === 0) {
    if (missing.length > 0) {
      console.error(`de-slop: no matching files: ${missing.join(', ')}`);
    } else {
      console.log('de-slop: no matching files found');
    }
    return missing.length > 0 ? 1 : 0;
  }

  const remaining = [];
  let totalFixed = 0;
  for (const filePath of files) {
    const diagnostics = scanFile(filePath, rules);
    const fixable = diagnostics.filter((diagnostic) => diagnostic.fix !== undefined);
    if (fixable.length > 0) {
      const code = readFileSync(filePath, 'utf8');
      const fixedCode = applyFixes(code, diagnostics);
      if (fixedCode !== code) {
        writeFileSync(filePath, fixedCode, 'utf8');
        console.log(`fixed ${fixable.length} issues in ${filePath}`);
        totalFixed += fixable.length;
      }
    }
    remaining.push(...diagnostics.filter((diagnostic) => diagnostic.fix === undefined));
  }

  let errors = 0;
  let warnings = 0;
  for (const diagnostic of remaining) {
    if (diagnostic.severity === 'error') errors += 1;
    else if (diagnostic.severity === 'warning') warnings += 1;
    console.log(
      `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.message}`
    );
  }
  console.log(`fixed ${totalFixed} issues, ${remaining.length} problems remain (${errors} errors, ${warnings} warnings)`);
  return errors > 0 ? 1 : 0;
}

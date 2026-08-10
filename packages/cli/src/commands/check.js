import { verifyTestFile, checkPackageManifest } from '@de-slop/core';
import { parseArgs } from '../args.js';
import { findSourceFiles } from '../files.js';
import { scanFile } from '../scan.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const help = `de-slop check — scan source files for AI slop patterns

Usage: de-slop check [paths...] [options]

Scans each file with the slop-scanner and the runtime-guard, then reports
every diagnostic as: filePath:line:col severity ruleId message

Options:
  --rules <a,b,c>  Only run the given rule ids
  --lock           Also verify .test.* files against .de-slop/test-lock.json
  --help           Show this help

Exit code is 1 when any error-severity diagnostic is found, 0 otherwise.
`;

function splitRules(value) {
  return typeof value === 'string'
    ? value.split(',').map((part) => part.trim()).filter(Boolean)
    : undefined;
}

function byPosition(a, b) {
  if (a.filePath !== b.filePath) return a.filePath < b.filePath ? -1 : 1;
  if (a.line !== b.line) return a.line - b.line;
  return a.column - b.column;
}

export default async function check(argv) {
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

  const diagnostics = [];
  for (const filePath of files) {
    diagnostics.push(...scanFile(filePath, rules));
  }

  const checkTestLock = options.lock && (rules === undefined || rules.includes('test-lock'));
  if (checkTestLock) {
    for (const filePath of files) {
      if (!/\.test\./.test(filePath)) continue;
      for (const violation of verifyTestFile(filePath)) {
        diagnostics.push({
          ruleId: 'test-lock',
          severity: 'error',
          message: violation.message,
          filePath,
          line: violation.line ?? 0,
          column: 0,
        });
      }
    }
  }

  for (const filePath of files) {
    if (filePath !== 'package.json' && !filePath.endsWith('/package.json')) continue;
    let manifestText;
    try {
      manifestText = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    for (const finding of checkPackageManifest(manifestText)) {
      diagnostics.push({
        ruleId: 'package-gate',
        severity: finding.verdict === 'block' ? 'error' : 'warning',
        message: finding.reasons.join('; '),
        filePath,
        line: 0,
        column: 0,
      });
    }
  }

  diagnostics.sort(byPosition);
  let errors = 0;
  let warnings = 0;
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') errors += 1;
    else if (diagnostic.severity === 'warning') warnings += 1;
    console.log(
      `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.message}`
    );
  }
  console.log(`${diagnostics.length} problems found (${errors} errors, ${warnings} warnings)`);
  return errors > 0 ? 1 : 0;
}

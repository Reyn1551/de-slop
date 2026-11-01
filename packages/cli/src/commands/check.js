import { readFileSync } from 'node:fs';
import {
  verifyTestFile,
  checkPackageManifest,
  scanContent,
  scanContextRot,
  collectRepoFacts,
  isAgentConfig,
  findDesignContract,
  designContractScan,
  parseDesignContract,
  isContractParseError,
} from '@de-slop/core';
import { parseArgs } from '../args.js';
import { loadConfig } from '../config.js';
import { findSourceFiles } from '../files.js';

export const help = `de-slop check — scan code, markup, and docs for AI slop

Usage: de-slop check [paths...] [options]

Runs every detector that applies to a file:

  slop-scanner   AST rules for code slop and security defects
  runtime-guard  unhandled promises, missing cleanup, null access
  agent-guard    prompt injection, invisible unicode, unsafe install docs
  design-slop    AI design tells (palette, gradients, glass, fonts)
  ux-guard       provable accessibility and interaction failures (JSX/HTML/CSS)
  prose-slop     AI writing tells (Markdown and text)
  test-lock      test files against .de-slop/test-lock.json (with --lock)
  package-gate   install scripts in package.json

Output is one line per finding: filePath:line:col severity ruleId message.

Options:
  --rules <a,b,c>     Only run the given rule ids (default: .desloprc rules)
  --lock              Also verify .test.* files against the test-lock store
  --strict            Exit 1 on warnings too
  --design-md <path>  Use this DESIGN.md contract instead of searching upward
  --help              Show this help

When the project has a DESIGN.md, declared colors, fonts, and radii stop being
flagged, and values used often enough to be deliberate but never declared are
reported as drift.

Exit code is 1 when any error-severity finding is reported.
`;

function splitRules(value) {
  return typeof value === 'string'
    ? value.split(',').map((part) => part.trim()).filter(Boolean)
    : undefined;
}

function resolveContract(explicitPath) {
  if (typeof explicitPath === 'string') {
    const parsed = parseDesignContract(readFileSync(explicitPath, 'utf8'), explicitPath);
    if (isContractParseError(parsed)) return { value: null, error: parsed };
    return { value: parsed, error: null };
  }
  const lookup = findDesignContract(process.cwd());
  return { value: lookup.contract, error: lookup.error };
}

function byPosition(a, b) {
  if (a.filePath !== b.filePath) return a.filePath < b.filePath ? -1 : 1;
  if (a.line !== b.line) return a.line - b.line;
  return a.column - b.column;
}

export default async function check(argv) {
  const { positional, options } = parseArgs(argv);
  const config = loadConfig(process.cwd());
  const paths = positional.length > 0 ? positional : ['.'];
  const rules = splitRules(options.rules) ?? (config.rules.length > 0 ? config.rules : undefined);
  const strict = options.strict === true || config.strict;

  const { files, missing } = findSourceFiles(paths);
  if (files.length === 0) {
    if (missing.length > 0) {
      console.error(`de-slop: no matching files: ${missing.join(', ')}`);
    } else {
      console.log('de-slop: no matching files found');
    }
    return missing.length > 0 ? 1 : 0;
  }

  const contract = resolveContract(options['design-md']);
  if (contract.error !== null) {
    console.error(`de-slop: ${contract.error.path}: ${contract.error.message}`);
  }

  const diagnostics = [];
  const sources = [];
  for (const filePath of files) {
    let code;
    try {
      code = readFileSync(filePath, 'utf8');
    } catch (err) {
      diagnostics.push({
        ruleId: 'scan-error',
        severity: 'error',
        message: err.message,
        filePath,
        line: 0,
        column: 0,
      });
      continue;
    }
    sources.push({ filePath, code });
    diagnostics.push(
      ...scanContent(code, filePath, {
        ...(rules ? { rules } : {}),
        contract: contract.value,
        hasContract: contract.value !== null,
      }),
    );
    if (contract.value !== null) {
      diagnostics.push(...designContractScan(code, filePath, { contract: contract.value }));
    }
  }

  const agentConfigs = sources.filter((source) => isAgentConfig(source.filePath));
  if (agentConfigs.length > 0) {
    const packageJson = sources.find((source) => source.filePath.endsWith('package.json'))?.code;
    const facts = collectRepoFacts(sources, packageJson);
    for (const config of agentConfigs) {
      diagnostics.push(...scanContextRot(config.code, config.filePath, facts, rules ? { rules } : {}));
    }
  }

  if (options.lock && (rules === undefined || rules.includes('test-lock'))) {
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
      `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.message}`,
    );
  }
  console.log(`${diagnostics.length} problems found (${errors} errors, ${warnings} warnings)`);
  return errors > 0 || (strict && warnings > 0) ? 1 : 0;
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPackages } from '@de-slop/core';
import { verifyTestFile } from '@de-slop/core/test-lock';
import { parseArgs } from '../args.js';
import { findSourceFiles } from '../files.js';
import { scanFile } from '../scan.js';

export const help = `de-slop report — run the full guardrail suite and emit a report

Usage: de-slop report [paths...] [options]

Runs every de-slop module against the target and writes:
  REPORT.md           human-readable report with analysis
  report.json         raw machine-readable data

Checks included:
  slop-scanner       9 rules (slop, security, hallucination, naming)
  runtime-guard      3 rules (edge cases, leaks)
  test-lock          test files vs locked fingerprint
  package-gate       every dependency in package.json
  spec-contractor    if a de-slop.spec.yml exists

Options:
  --out <dir>   Where to write the report (default: .de-slop/reports)
  --help        Show this help
`;

function parseDeps(source) {
  try {
    const pkg = JSON.parse(source);
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return Object.entries(deps).map(([name, version]) => ({ name, version: String(version) }));
  } catch {
    return [];
  }
}

function countBySeverity(diagnostics) {
  let errors = 0;
  let warnings = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errors += 1;
    else if (d.severity === 'warning') warnings += 1;
  }
  return { errors, warnings };
}

function markdownReport(data) {
  const lines = [];
  lines.push('# de-slop Report');
  lines.push('');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Target: \`${data.target}\``);
  lines.push('');

  const totals = { errors: 0, warnings: 0, info: 0 };
  for (const file of data.files) {
    totals.errors += file.errors;
    totals.warnings += file.warnings;
  }
  for (const dep of data.packages) {
    if (dep.verdict === 'ok') totals.info += 1;
    else totals.errors += 1;
  }
  totals.errors += data.testLock.violations.length;
  for (const spec of data.spec) {
    for (const violation of spec.violations ?? []) {
      if (violation.severity === 'error') totals.errors += 1;
      else totals.warnings += 1;
    }
  }

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Files scanned: **${data.files.length}**`);
  lines.push(`- Dependencies audited: **${data.packages.length}**`);
  lines.push(`- Test files locked: **${data.testLock.locked}**`);
  lines.push(`- Specs checked: **${data.spec.length}**`);
  lines.push(`- **${totals.errors} errors, ${totals.warnings} warnings, ${totals.info} ok**`);
  lines.push('');

  if (data.files.some((f) => f.diagnostics.length > 0)) {
    lines.push('## Diagnostics');
    lines.push('');
    lines.push('| File | Line | Col | Severity | Rule | Message |');
    lines.push('|---|---|---|---|---|---|');
    for (const file of data.files) {
      for (const d of file.diagnostics) {
        const shortPath = file.path.replace(data.target, '.');
        lines.push(`| \`${shortPath}\` | ${d.line} | ${d.column} | ${d.severity} | \`${d.ruleId}\` | ${d.message} |`);
      }
    }
    lines.push('');
  }

  const risky = data.packages.filter((p) => p.verdict !== 'ok');
  if (risky.length > 0) {
    lines.push('## Package Gate — at-risk dependencies');
    lines.push('');
    lines.push('| Package | Ecosystem | Verdict | Reasons |');
    lines.push('|---|---|---|---|');
    for (const p of risky) {
      lines.push(`| \`${p.name}\` | ${p.ecosystem} | ${p.verdict} | ${p.reasons.join('; ')} |`);
    }
    lines.push('');
  }

  if (data.testLock.violations.length > 0) {
    lines.push('## Test-Lock violations');
    lines.push('');
    for (const v of data.testLock.violations) {
      lines.push(`- \`${v.message}\` (${v.type ?? 'unknown'})`);
    }
    lines.push('');
  }

  if (data.spec.length > 0) {
    for (const spec of data.spec) {
      if ((spec.violations ?? []).length > 0) {
        lines.push(`## Spec violations — ${spec.specPath}`);
        lines.push('');
        for (const v of spec.violations) {
          lines.push(`- \`${v.severity}\` ${v.message}`);
        }
        lines.push('');
      }
    }
  }

  const byRule = new Map();
  for (const file of data.files) {
    for (const d of file.diagnostics) {
      byRule.set(d.ruleId, (byRule.get(d.ruleId) ?? 0) + 1);
    }
  }
  if (byRule.size > 0) {
    lines.push('## Analysis — rule frequency');
    lines.push('');
    const sorted = [...byRule.entries()].sort((a, b) => b[1] - a[1]);
    for (const [rule, count] of sorted) {
      lines.push(`- \`${rule}\`: ${count}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export default async function report(argv) {
  const { positional, options } = parseArgs(argv);
  const target = positional[0] ?? '.';
  const outDir = options.out ?? '.de-slop/reports';

  const { files, missing } = findSourceFiles([target]);
  const diagnosticsByFile = [];
  for (const filePath of files) {
    const diagnostics = scanFile(filePath);
    const { errors, warnings } = countBySeverity(diagnostics);
    diagnosticsByFile.push({ path: filePath, diagnostics, errors, warnings });
  }

  const testViolations = [];
  let lockedCount = 0;
  for (const filePath of files) {
    if (!/\.test\./.test(filePath)) continue;
    lockedCount += 1;
    try {
      testViolations.push(...await verifyTestFile(filePath));
    } catch {
      testViolations.push({ type: 'not-locked', message: `${filePath} has no locked fingerprint` });
    }
  }

  let packageReports = [];
  try {
    const pkgSource = readFileSync(join(target, 'package.json'), 'utf8');
    const deps = parseDeps(pkgSource);
    packageReports = await checkPackages(deps.map((d) => d.name));
    packageReports = packageReports.map((r, i) => ({ ...r, version: deps[i]?.version ?? '' }));
  } catch {
    // no package.json — skip package gate
  }

  let specResults = [];
  const specPath = join(target, 'de-slop.spec.yml');
  try {
    readFileSync(specPath, 'utf8');
    const { runSpecCheck } = await import('@de-slop/core/spec-contractor');
    specResults = await runSpecCheck(specPath, [`${target}/**/*.ts`]);
  } catch {
    // no spec file — skip
  }

  const data = {
    generatedAt: new Date().toISOString(),
    target,
    files: diagnosticsByFile,
    packages: packageReports,
    testLock: { locked: lockedCount, violations: testViolations },
    spec: specResults,
  };

  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, 'REPORT.md');
  const jsonPath = join(outDir, 'report.json');
  writeFileSync(mdPath, markdownReport(data), 'utf8');
  writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log(`de-slop report: wrote ${mdPath}`);
  console.log(`de-slop report: wrote ${jsonPath}`);
  return 0;
}

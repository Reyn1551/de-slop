import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  analyzeProject,
  checkPackages,
  findDesignContract,
  htmlReport,
  HUMAN_EROSION_BASELINE,
  HUMAN_VERBOSITY_BASELINE,
} from '@de-slop/core';
import { verifyTestFile } from '@de-slop/core/test-lock';
import { parseArgs } from '../args.js';
import { findSourceFiles } from '../files.js';
import { scanFile } from '../scan.js';

export const help = `de-slop report — run the full guardrail suite and emit a report

Usage: de-slop report [paths...] [options]

Runs every de-slop module against the target and writes:
  REPORT.md           human-readable report with analysis
  REPORT.html         standalone HTML report, no scripts or external requests
  report.json         raw machine-readable data

Checks included:
  every detector that applies to each file (code, markup, docs)
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
  if (data.degradation) {
    lines.push(`- Erosion: **${data.degradation.erosion.toFixed(3)}** (human mean ${HUMAN_EROSION_BASELINE})`);
    lines.push(`- Verbosity: **${data.degradation.verbosity.toFixed(3)}** (human mean ${HUMAN_VERBOSITY_BASELINE})`);
  }
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

  if (data.degradation) {
    lines.push('## Degradation');
    lines.push('');
    lines.push('| File | Erosion | Verbosity | Max CC |');
    lines.push('|---|---|---|---|');
    const worst = [...data.degradation.files]
      .sort((a, b) => b.erosion - a.erosion)
      .slice(0, 10)
      .filter((file) => file.erosion > 0 || file.verbosity > 0);
    for (const file of worst) {
      lines.push(`| \`${file.filePath}\` | ${file.erosion.toFixed(3)} | ${file.verbosity.toFixed(3)} | ${file.maxCyclomatic} |`);
    }
    lines.push('');
  }

  const risky = data.packages.filter((p) => p.verdict !== 'ok');
  if (risky.length > 0) {
    lines.push('## Package gate: at-risk dependencies');
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
    lines.push('## Rule frequency');
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

  const { files } = findSourceFiles([target]);
  const lookup = findDesignContract(process.cwd());
  if (lookup.error !== null) {
    console.error(`de-slop report: ${lookup.error.path}: ${lookup.error.message}`);
  }
  const contract = lookup.contract;
  const diagnosticsByFile = [];
  for (const filePath of files) {
    const diagnostics = scanFile(filePath, undefined, contract);
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
  const manifestPath = join(target, 'package.json');
  const pkgSource = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;
  if (pkgSource !== null) {
    try {
      const deps = parseDeps(pkgSource);
      packageReports = await checkPackages(deps.map((d) => d.name));
      packageReports = packageReports.map((r, i) => ({ ...r, version: deps[i]?.version ?? '' }));
    } catch (err) {
      console.error(`de-slop report: registry check skipped (${err.message})`);
    }
  }

  let specResults = [];
  const specPath = join(target, 'de-slop.spec.yml');
  if (existsSync(specPath)) {
    const { runSpecCheck } = await import('@de-slop/core/spec-contractor');
    specResults = await runSpecCheck(specPath, [`${target}/**/*.ts`]);
  }

  const sources = [];
  for (const filePath of files) {
    if (!/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(filePath)) continue;
    try {
      sources.push({ filePath, code: readFileSync(filePath, 'utf8') });
    } catch {
      continue;
    }
  }

  const data = {
    generatedAt: new Date().toISOString(),
    target,
    files: diagnosticsByFile,
    degradation: sources.length > 0 ? analyzeProject(sources) : null,
    packages: packageReports,
    testLock: { locked: lockedCount, violations: testViolations },
    spec: specResults,
  };

  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, 'REPORT.md');
  const htmlPath = join(outDir, 'REPORT.html');
  const jsonPath = join(outDir, 'report.json');
  writeFileSync(mdPath, markdownReport(data), 'utf8');
  writeFileSync(htmlPath, htmlReport(data), 'utf8');
  writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log(`de-slop report: wrote ${mdPath}`);
  console.log(`de-slop report: wrote ${htmlPath}`);
  console.log(`de-slop report: wrote ${jsonPath}`);
  return 0;
}

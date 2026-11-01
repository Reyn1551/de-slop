import { readFileSync } from 'node:fs';
import {
  analyzeProject,
  compareBaseline,
  loadBaseline,
  saveBaseline,
  HUMAN_EROSION_BASELINE,
  HUMAN_VERBOSITY_BASELINE,
} from '@de-slop/core';
import { parseArgs } from '../args.js';
import { loadConfig } from '../config.js';
import { findSourceFiles } from '../files.js';

export const help = `de-slop budget — measure code degradation against a baseline

Usage: de-slop budget [paths...] [options]

Computes the two SlopCodeBench metrics for every TypeScript/JavaScript file:

  erosion    share of complexity mass held by functions with cyclomatic
             complexity above 10 (mass = CC * sqrt(SLOC))
  verbosity  share of lines that are either verbose-code patterns or
             duplicates of another 5-line block

Published reference points: human repositories average erosion 0.34 and
verbosity 0.19; agent checkpoints average 0.68 and 0.44.

Options:
  --save             Write the current metrics to the baseline file
  --baseline <path>  Baseline file (default: .de-slop/baseline.json)
  --tolerance <n>    Allowed growth before the run fails (default: 0.02)
  --ceiling          Also fail when erosion or verbosity exceed the human means
  --json             Print machine-readable JSON
  --help             Show this help

Exit code is 1 when the current run degraded past the baseline or ceiling.
`;

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

function readSources(files) {
  const sources = [];
  for (const filePath of files) {
    if (!CODE_FILE.test(filePath)) continue;
    try {
      sources.push({ filePath, code: readFileSync(filePath, 'utf8') });
    } catch {
      continue;
    }
  }
  return sources;
}

export default async function budget(argv) {
  const { positional, options } = parseArgs(argv);
  const config = loadConfig(process.cwd());
  const paths = positional.length > 0 ? positional : ['.'];
  const baselinePath = options.baseline ?? config.budget.baseline;
  const tolerance = Number(options.tolerance ?? config.budget.tolerance);

  const { files } = findSourceFiles(paths);
  const sources = readSources(files);
  if (sources.length === 0) {
    console.log('de-slop budget: no TypeScript or JavaScript files found');
    return 0;
  }

  const current = analyzeProject(sources);

  if (options.save) {
    await saveBaseline(baselinePath, current);
    console.log(`de-slop budget: baseline written to ${baselinePath}`);
  }

  const baseline = await loadBaseline(baselinePath);
  const delta = baseline ? compareBaseline(current, baseline, tolerance) : null;

  const overCeiling =
    (options.ceiling === true || (options.ceiling === undefined && config.budget.ceiling)) &&
    (current.erosion > HUMAN_EROSION_BASELINE || current.verbosity > HUMAN_VERBOSITY_BASELINE);

  if (options.json) {
    console.log(JSON.stringify({ current, delta, overCeiling }, null, 2));
    return delta?.degrading === true || overCeiling ? 1 : 0;
  }

  console.log(`files ${current.files.length}  loc ${current.loc}  functions ${current.functionCount}`);
  console.log(
    `erosion ${current.erosion.toFixed(3)}  verbosity ${current.verbosity.toFixed(3)}  (human means ${HUMAN_EROSION_BASELINE} / ${HUMAN_VERBOSITY_BASELINE})`,
  );

  const worst = [...current.files]
    .sort((a, b) => b.erosion - a.erosion)
    .slice(0, 5)
    .filter((file) => file.erosion > 0 || file.verbosity > 0);
  for (const file of worst) {
    console.log(
      `  ${file.filePath} — erosion ${file.erosion.toFixed(3)} verbosity ${file.verbosity.toFixed(3)} maxCC ${file.maxCyclomatic}`,
    );
  }

  if (delta === null) {
    console.log(`de-slop budget: no baseline at ${baselinePath} — run with --save to record one`);
    return overCeiling ? 1 : 0;
  }

  if (delta.degrading) {
    console.error(`de-slop budget: degraded since baseline — ${delta.reasons.join('; ')}`);
  } else {
    console.log('de-slop budget: no degradation past tolerance');
  }

  if (overCeiling) {
    console.error('de-slop budget: metrics exceed the published human-repository means');
  }

  return delta.degrading || overCeiling ? 1 : 0;
}

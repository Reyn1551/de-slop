import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const CONFIG_FILE = '.desloprc.json';

const DEFAULT_EXCLUDES = ['node_modules', 'dist', '.git'];

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === 'string' && entry.length > 0);
}

function readConfig(startDir) {
  let directory = resolve(startDir);
  for (;;) {
    const candidate = join(directory, CONFIG_FILE);
    if (existsSync(candidate)) {
      try {
        const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
        return parsed !== null && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    const parent = dirname(directory);
    if (parent === directory) return {};
    directory = parent;
  }
}

/**
 * Read the nearest `.desloprc.json`, walking up to the filesystem root.
 * Unknown keys are ignored and a malformed file falls back to defaults, so a
 * broken config never stops a scan.
 */
export function loadConfig(startDir = process.cwd()) {
  const raw = readConfig(startDir);
  const budget = raw.budget !== null && typeof raw.budget === 'object' ? raw.budget : {};

  return {
    exclude: [...new Set([...DEFAULT_EXCLUDES, ...stringList(raw.exclude)])],
    rules: stringList(raw.rules),
    strict: raw.strict === true,
    prose: stringList(raw.prose),
    ux: stringList(raw.ux),
    budget: {
      tolerance: typeof budget.tolerance === 'number' ? budget.tolerance : 0.02,
      ceiling: budget.ceiling === true,
      baseline: typeof budget.baseline === 'string' ? budget.baseline : join('.de-slop', 'baseline.json'),
    },
  };
}

export { DEFAULT_EXCLUDES };

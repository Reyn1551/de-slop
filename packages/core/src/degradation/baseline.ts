import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { BaselineDelta, ProjectMetrics } from './types';

export const HUMAN_EROSION_BASELINE = 0.34;
export const HUMAN_VERBOSITY_BASELINE = 0.19;
export const AGENT_EROSION_BASELINE = 0.68;
export const AGENT_VERBOSITY_BASELINE = 0.44;

const DEFAULT_TOLERANCE = 0.02;

function formatDelta(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
}

function isProjectMetrics(value: unknown): value is ProjectMetrics {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ProjectMetrics>;
  return (
    Array.isArray(candidate.files) &&
    typeof candidate.loc === 'number' &&
    typeof candidate.sloc === 'number' &&
    typeof candidate.functionCount === 'number' &&
    typeof candidate.erosion === 'number' &&
    typeof candidate.verbosity === 'number'
  );
}

export function compareBaseline(
  current: ProjectMetrics,
  baseline: ProjectMetrics,
  tolerance = DEFAULT_TOLERANCE,
): BaselineDelta {
  const erosion = current.erosion - baseline.erosion;
  const verbosity = current.verbosity - baseline.verbosity;
  const loc = current.loc - baseline.loc;
  const reasons: string[] = [];

  if (erosion > tolerance) {
    reasons.push(`erosion rose ${formatDelta(erosion)} (${baseline.erosion.toFixed(3)} -> ${current.erosion.toFixed(3)})`);
  }
  if (verbosity > tolerance) {
    reasons.push(
      `verbosity rose ${formatDelta(verbosity)} (${baseline.verbosity.toFixed(3)} -> ${current.verbosity.toFixed(3)})`,
    );
  }

  return {
    erosion,
    verbosity,
    loc,
    degrading: erosion > tolerance || verbosity > tolerance,
    reasons,
  };
}

export async function saveBaseline(path: string, metrics: ProjectMetrics): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
}

export async function loadBaseline(path: string): Promise<ProjectMetrics | null> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isProjectMetrics(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

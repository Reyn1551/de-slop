import type { UxFinding, UxRuleFn } from '../types';
import { collectRegex, finding } from '../utils';

const OFF_GRID = /(?:^|[\s"'`:])(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap)-\[(\d+)px\]/g;

export const noOffGridSpacing: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  for (const hit of collectRegex(code, OFF_GRID)) {
    const px = Number(hit.match.match(/\[(\d+)px\]/)?.[1] ?? 0);
    if (px % 4 === 0) continue;
    findings.push(
      finding(
        locator,
        hit.index + (hit.match.length - hit.match.trimStart().length),
        'warning',
        `Off-grid spacing ${px}px is not a multiple of 4 — arbitrary values break vertical rhythm; snap to the 4px scale (4/8/12/16/24)`,
      ),
    );
  }
  return findings;
};

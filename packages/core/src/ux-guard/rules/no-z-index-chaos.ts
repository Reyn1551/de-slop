import type { UxFinding, UxRuleFn } from '../types';
import { collectRegex, finding } from '../utils';

export const noZIndexChaos: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  for (const hit of collectRegex(code, /(?:^|[\s"'`])z-\[(\d+)\]/g)) {
    const value = Number(hit.match.match(/\[(\d+)\]/)?.[1] ?? 0);
    if (value < 1000) continue;
    findings.push(
      finding(
        locator,
        hit.index + (hit.match.length - hit.match.trimStart().length),
        'warning',
        `Arbitrary z-index ${value} — numbers in the thousands mean the layer stack has lost its model; define a fixed scale (0/10/20/30/40/50) instead`,
      ),
    );
  }
  return findings;
};

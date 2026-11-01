import type { UxFinding, UxRuleFn } from '../types';
import { collectRegex, finding } from '../utils';

const ZOOM_BLOCK =
  /(?:user-scalable\s*=\s*["']?no["']?|maximum-scale\s*=\s*["']?1(?:\.0+)?["']?(?![.\d]))/gi;

export const noZoomBlock: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  for (const hit of collectRegex(code, ZOOM_BLOCK)) {
    findings.push(
      finding(
        locator,
        hit.index,
        'error',
        `Viewport disables pinch zoom (${hit.match.trim()}) — users with low vision must be able to scale to 200% (WCAG 1.4.4)`,
      ),
    );
  }
  return findings;
};

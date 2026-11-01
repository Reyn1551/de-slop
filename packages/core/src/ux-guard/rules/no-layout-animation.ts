import type { UxFinding, UxRuleFn } from '../types';
import { collectRegex, finding } from '../utils';

const LAYOUT_PROP = /\b(?:width|height|top|left|right|bottom|margin(?:-[a-z]+)?)\s*:/;

function blockEnd(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return code.length;
}

export const noLayoutAnimation: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];

  for (const hit of collectRegex(code, /(?:^|[\s"'`:])transition-all\b/g)) {
    findings.push(
      finding(
        locator,
        hit.index + hit.match.length - 'transition-all'.length,
        'warning',
        'transition-all animates every property, layout included — width/height/top/left transitions reflow on every frame; animate transform and opacity, or list the intended properties',
      ),
    );
  }

  for (const hit of collectRegex(code, /@keyframes\s+[\w-]+\s*\{/g)) {
    const open = hit.index + hit.match.length - 1;
    if (!LAYOUT_PROP.test(code.slice(open, blockEnd(code, open) + 1))) continue;
    findings.push(
      finding(
        locator,
        hit.index,
        'warning',
        '@keyframes animates layout properties (width/height/top/left/right/bottom/margin) — every frame forces layout; animate transform and opacity instead',
      ),
    );
  }

  for (const hit of collectRegex(code, /transition\s*:[^;{}]+;/g)) {
    if (!LAYOUT_PROP.test(hit.match)) continue;
    findings.push(
      finding(
        locator,
        hit.index,
        'warning',
        'Transition targets a layout property — transitions on width/height/top/left reflow each frame; animate transform instead',
      ),
    );
  }

  return findings;
};

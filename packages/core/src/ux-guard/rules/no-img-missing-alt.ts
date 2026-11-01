import type { UxFinding, UxRuleFn } from '../types';
import { collectTags, finding } from '../utils';

export const noImgMissingAlt: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  for (const { tag, index, name } of collectTags(code)) {
    if (name !== 'img') continue;
    if (/(?:^|\s)alt\s*=/.test(tag)) continue;
    findings.push(
      finding(
        locator,
        index,
        'error',
        '<img> without alt — screen readers announce nothing useful; describe the image, or alt="" when it is purely decorative (WCAG 1.1.1)',
      ),
    );
  }
  return findings;
};

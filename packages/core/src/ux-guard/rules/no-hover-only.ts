import type { UxFinding, UxRuleFn } from '../types';
import { classNameOf, collectTags, finding } from '../utils';

const REVEAL = /^(?:hover|group-hover):(?:opacity-|block$|flex$|visible$|translate-)/;

export const noHoverOnly: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  for (const { tag, index } of collectTags(code)) {
    const className = classNameOf(tag);
    if (!className) continue;
    const tokens = className.split(/\s+/);

    const reveals = tokens.filter((token) => REVEAL.test(token));
    if (reveals.length === 0) continue;
    if (tokens.some((token) => /^(?:focus|focus-within|focus-visible):/.test(token))) continue;

    findings.push(
      finding(
        locator,
        index,
        'warning',
        `Content revealed only on hover (${reveals[0]}) — touch and keyboard users never see it; add a focus-visible:/focus-within: equivalent or keep it visible (WCAG 2.1.1)`,
      ),
    );
  }
  return findings;
};

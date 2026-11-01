import type { UxFinding, UxRuleFn } from '../types';
import { classNameOf, collectTags, finding } from '../utils';

const FOCUSABLE: Record<string, true> = { button: true, a: true, input: true, select: true, textarea: true };

export const noFocusRemoved: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  for (const { tag, index, name } of collectTags(code)) {
    if (!FOCUSABLE[name]) continue;
    const className = classNameOf(tag);
    if (!className) continue;
    const tokens = className.split(/\s+/);

    if (!tokens.some((token) => /(?:^|:)outline-(?:none|0)$/.test(token))) continue;

    const restoresFocus = tokens.some(
      (token) =>
        /(?:^|:)focus-visible:ring(?:-|$|\[)/.test(token) ||
        /(?:^|:)focus:ring(?:-|$|\[)/.test(token) ||
        /(?:^|:)focus-visible:outline(?:-|$|\[)/.test(token),
    );
    if (restoresFocus) continue;

    findings.push(
      finding(
        locator,
        index,
        'error',
        'Focus outline removed with no visible replacement — keyboard users lose their position; pair outline-none with focus-visible:ring or focus-visible:outline (WCAG 2.4.7)',
      ),
    );
  }
  return findings;
};

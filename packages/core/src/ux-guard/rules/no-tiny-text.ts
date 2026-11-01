import type { UxFinding, UxRuleFn } from '../types';
import { classNameOf, collectRegex, collectTags, finding } from '../utils';

const ARBITRARY_TINY = /(?:^|[\s"'`:])text-\[(?:9|10|11)px\]/g;
const BODY_ELEMENTS: Record<string, true> = { p: true, li: true, body: true };

export const noTinyText: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];

  for (const hit of collectRegex(code, ARBITRARY_TINY)) {
    const size = hit.match.match(/text-\[\d+px\]/)?.[0] ?? 'tiny text';
    findings.push(
      finding(
        locator,
        hit.index + (hit.match.length - hit.match.trimStart().length),
        'warning',
        `Font size below 12px (${size}) — unreadable on phones and for low-vision users; 12px is the practical floor (WCAG 1.4.4)`,
      ),
    );
  }

  for (const { tag, index, name } of collectTags(code)) {
    if (!BODY_ELEMENTS[name]) continue;
    const className = classNameOf(tag);
    if (!className) continue;
    const tokens = className.split(/\s+/);
    if (!tokens.includes('text-xs')) continue;
    if (tokens.some((token) => /^text-(?:\[|\d|base|sm|lg|xl)/.test(token))) continue;

    findings.push(
      finding(
        locator,
        index,
        'warning',
        'Body copy set at text-xs (12px) — too small for sustained reading; use text-sm or larger for prose, reserving text-xs for labels and metadata',
      ),
    );
  }

  return findings;
};

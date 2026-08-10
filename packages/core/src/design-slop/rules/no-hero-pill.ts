import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// A pill/badge floating above a hero heading is the #1 landing-page tell
// (Krebs "hero pill", the anti-slop "colored dot + text pill above title").
// The slop-scanner version only catches className literals like `hero-pill`;
// this one catches the real-world implementation: a `<Badge>` component or a
// rounded-full pill div whose className sits BEFORE an <h1>/<h2> in source order.

const BADGE_COMPONENT = /<Badge\b[^>]*>/g;

// pill-shaped wrapper: rounded-full + horizontal/vertical padding + small text
const PILL_CLASS = /className\s*=\s*["'][^"']*\brounded-full\b[^"']*\b(?:px-[2-4]|px-2\.5|px-3\.5)\b[^"']*\b(?:py-0?\.?5|py-1|py-1\.5|py-2)\b[^"']*\b(?:text-xs|text-sm|text-\[1[012]px\])\b[^"']*["']/g;

// pillar shape alternative: pill classes on any element (div/span/p) via props
const PILL_ELEMENT = /<(?:div|span|p|section)\b[^>]*\b(?:rounded-full|rounded-\[9999px\])\b[^>]*\b(?:px-[2-4]|px-2\.5|px-3\.5)\b[^>]*\b(?:text-xs|text-sm)\b[^>]*>/g;

const HEADING = /<h1\b|<h2\b/g;

// emoji + short uppercase label = the classic pill content ("🚀 Now Live")
const PILL_TEXT = /[🚀✨🎉💡🔥⚡✅🎯🌟💫]/;

export const noHeroPill: DesignSlopRuleFn = (code, _filePath, locator) => {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  const pills: number[] = [];
  for (const hit of collectRegex(code, BADGE_COMPONENT)) {
    const window = code.slice(hit.index, hit.index + 200);
    if (PILL_TEXT.test(window) || /uppercase|tracking-wide|text-xs|text-sm/.test(window)) {
      pills.push(hit.index);
    }
  }
  for (const hit of collectRegex(code, PILL_CLASS)) pills.push(hit.index);
  for (const hit of collectRegex(code, PILL_ELEMENT)) pills.push(hit.index);

  const headings = collectRegex(code, HEADING).map((h) => h.index);
  if (pills.length === 0 || headings.length === 0) return findings;

  for (const pillPos of pills) {
    const nextHeading = headings.find((h) => h > pillPos);
    if (nextHeading === undefined) continue;
    // pill must sit within ~6 lines of the heading to be a hero pill
    const slice = code.slice(pillPos, nextHeading);
    if (slice.split('\n').length > 7) continue;

    const loc = toColumn(locator.getLineAndCharacterOfPosition(pillPos));
    findings.push({
      severity: 'warning',
      message: 'Hero pill badge floating above a heading — the #1 AI slop landing-page tell. Remove it or replace with a real product signal (e.g. an actual stat).',
      ...loc,
    });
  }

  return findings;
};

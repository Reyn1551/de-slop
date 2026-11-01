import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { toColumn } from '../utils';

// A pill/badge floating above a hero heading is the #1 landing-page tell
// (Krebs "hero pill", the anti-slop "colored dot + text pill above title").
//
// Detection walks opening tags and judges each element once. Three separate
// patterns used to match the same span — the className literal, the element,
// and a `<Badge>` component — so one pill produced two identical findings at
// different columns. One element, one finding.
//
// A pill is: rounded-full (or the 9999px arbitrary value), horizontal padding,
// small text, and it sits within a few lines above an h1 or h2.

const TAG = /<(?:div|span|p|section|Badge|Tag|Chip)\b[^>]*>/g;
const HEADING = /<h[12]\b/g;

const PILL_TEXT_SIZE = /\btext-(?:xs|sm|\[\d+px\])/;
const HORIZONTAL_PADDING = /\b(?:px-(?:[2-4]|2\.5|3\.5)|px-\[)/;
const VERTICAL_PADDING = /\b(?:py-(?:0?\.?5|1|1\.5|2)|py-\[)/;
const PILL_RADIUS = /\b(?:rounded-full|rounded-\[9999px\])/;

// emoji plus a short label is the classic pill content ("Now live")
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const PILL_LABEL = /\b(?:uppercase|tracking-wide)\b/;

const MAX_LINES_TO_HEADING = 7;

function classNameOf(tag: string): string {
  const match = /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/.exec(tag);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function isPill(tag: string, body: string): boolean {
  const className = classNameOf(tag);
  const isComponent = /^<(?:Badge|Tag|Chip)\b/.test(tag);

  // A Badge/Tag/Chip carries its own radius, so the className only has to look
  // like a micro-label. A plain element has to declare the pill shape itself.
  const shaped = isComponent
    ? HORIZONTAL_PADDING.test(className) && PILL_TEXT_SIZE.test(className)
    : PILL_RADIUS.test(className) && HORIZONTAL_PADDING.test(className) && PILL_TEXT_SIZE.test(className);
  if (!shaped) return false;

  if (isComponent) return true;
  if (VERTICAL_PADDING.test(className)) return true;

  // An emoji or an uppercase micro-label inside the element seals it.
  return EMOJI.test(body) || PILL_LABEL.test(body);
}

export const noHeroPill: DesignSlopRuleFn = (code, _filePath, locator) => {
  const headings = [...code.matchAll(HEADING)].map((match) => match.index ?? 0);
  if (headings.length === 0) return [];

  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  for (const match of code.matchAll(TAG)) {
    const index = match.index ?? 0;
    const body = code.slice(index, index + 220);
    if (!isPill(match[0], body)) continue;

    const nextHeading = headings.find((heading) => heading > index);
    if (nextHeading === undefined) continue;
    if (code.slice(index, nextHeading).split('\n').length > MAX_LINES_TO_HEADING) continue;

    findings.push({
      severity: 'warning',
      message:
        'Hero pill badge floating above a heading — the #1 AI slop landing-page tell. Remove it or replace it with a real product signal (e.g. an actual stat).',
      ...toColumn(locator.getLineAndCharacterOfPosition(index)),
    });
  }

  return findings;
};

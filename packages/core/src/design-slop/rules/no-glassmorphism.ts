import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Glassmorphism — warning at 3+ non-navigation surfaces, error on a form or
// table. Sticky top/bottom navigation is exempt: Linear, Vercel, and GitHub all
// ship a blurred header, and the tasteful ceiling is 2-3 glass surfaces per
// viewport.
//
// Both spellings count: the Tailwind utility (`backdrop-blur`, `backdrop-blur-xl`)
// and the CSS declaration (`backdrop-filter: blur(16px)`). Exemption and error
// scopes are structural — the enclosing element or selector — not a character
// window, so `headerHeight` in a class name no longer exempts an unrelated card.

const BLUR =
  /backdrop-blur(?:-(?:sm|md|lg|xl|2xl|3xl)|-\[[^\]]+\])?|backdrop-filter\s*:\s*[^;}]*blur\(/g;

const EXEMPT_TAGS = ['nav', 'header', 'footer'];
const ERROR_TAGS = ['input', 'select', 'textarea', 'form', 'table', 'td', 'th'];
const EXEMPT_SELECTOR = /^(?:[^,{]*\b)?(?:nav|header|footer)\b/;
const ERROR_SELECTOR = /^(?:[^,{]*\b)?(?:input|select|textarea|form|table|td|th)\b/;

interface Region {
  start: number;
  end: number;
}

function elementRegions(code: string, names: string[]): Region[] {
  const regions: Region[] = [];
  const open: { name: string; start: number }[] = [];

  for (const match of code.matchAll(/<(\/?)([A-Za-z][\w.]*)\b[^<>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = match;
    const index = match.index ?? 0;
    const lower = name.toLowerCase();
    if (!names.includes(lower)) continue;

    if (closing === '/') {
      for (let depth = open.length - 1; depth >= 0; depth -= 1) {
        if (open[depth].name !== lower) continue;
        const [frame] = open.splice(depth, 1);
        regions.push({ start: frame.start, end: index + match[0].length });
        break;
      }
      continue;
    }

    if (selfClosing === '/') {
      regions.push({ start: index, end: index + match[0].length });
      continue;
    }
    open.push({ name: lower, start: index });
  }

  return regions;
}

function selectorRegions(code: string, matches: (selector: string) => boolean): Region[] {
  const regions: Region[] = [];
  for (const match of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!matches(match[1].trim())) continue;
    const start = match.index ?? 0;
    regions.push({ start, end: start + match[0].length });
  }
  return regions;
}

const inside = (regions: Region[], index: number): boolean =>
  regions.some((region) => index >= region.start && index < region.end);

export const noGlassmorphism: DesignSlopRuleFn = (code, _filePath, locator) => {
  const hits = collectRegex(code, BLUR);
  if (hits.length === 0) return [];

  const exempt = [
    ...elementRegions(code, EXEMPT_TAGS),
    ...selectorRegions(code, (selector) => EXEMPT_SELECTOR.test(selector)),
  ];
  const errors = [
    ...elementRegions(code, ERROR_TAGS),
    ...selectorRegions(code, (selector) => ERROR_SELECTOR.test(selector)),
  ];

  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
  const onForm = hits.find((hit) => inside(errors, hit.index));
  if (onForm) {
    findings.push({
      severity: 'error',
      message: 'Glassmorphism on a form field or table — contrast fails at the worst moment and the blur costs scroll performance; use a solid surface',
      ...toColumn(locator.getLineAndCharacterOfPosition(onForm.index)),
    });
  }

  const surfaces = hits.filter((hit) => !inside(exempt, hit.index) && !inside(errors, hit.index));
  if (surfaces.length >= 3) {
    findings.push({
      severity: 'warning',
      message: `${surfaces.length} glassmorphism surfaces outside navigation — the tasteful ceiling is 2-3 per viewport; glass everywhere is an AI tell`,
      ...toColumn(locator.getLineAndCharacterOfPosition(surfaces[0].index)),
    });
  }

  return findings;
};

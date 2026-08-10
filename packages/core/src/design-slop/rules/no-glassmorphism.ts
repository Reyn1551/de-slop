import type { DesignSlopRuleFn } from '../types';
import { collectRegex, toColumn } from '../utils';

// Glassmorphism (backdrop-blur) — warning at 3+ non-nav surfaces, error on form/table.
// Explicitly exempt sticky/fixed top/bottom nav + footer (Linear/Vercel/GitHub legit).
// Ceiling: 2-3 glass surfaces per viewport.

const BLUR_ANY = /backdrop-blur(?::?\s*\([^)]*\)|-[a-z0-9]+)?/g;
const FORM_GLASS = /(?:input|select|textarea|form|table|td|th)[^{}]{0,50}\{[^{}]*backdrop-blur[^}]*\}/gi;
const NAV_GLASS =
  /(?:nav|header|footer)[^{}]{0,80}\{[^{}]*(?:backdrop-blur|position\s*:\s*(?:sticky|fixed)[^}]*top)[^}]*\}/gi;
const NAV_CLASS = /(?:nav|header|footer)[\s\S]{0,120}(?:backdrop-blur)/gi;

export const noGlassmorphism: DesignSlopRuleFn = (code, _filePath, locator) => {
  const navHits = [...collectRegex(code, NAV_GLASS), ...collectRegex(code, NAV_CLASS)];
  const navIndexes = new Set(navHits.map((h) => h.index));

  const formHits = collectRegex(code, FORM_GLASS);
  if (formHits.length > 0) {
    const hit = formHits[0];
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    return [{
      severity: 'error',
      message: 'Glassmorphism on form input/table — WCAG 4.5:1 worst-moment failure and scroll-performance risk; use a solid surface',
      ...loc,
    }];
  }

  const blurHits = collectRegex(code, BLUR_ANY).filter((h) => !navIndexes.has(h.index));
  const nonNavCount = blurHits.length;
  if (nonNavCount < 3) return [];

  const loc = toColumn(locator.getLineAndCharacterOfPosition(blurHits[0].index));
  return [{
    severity: 'warning',
    message: `${nonNavCount} glassmorphism surfaces outside nav/header — tasteful ceiling is 2-3 per viewport; glass everywhere is an AI tell`,
    ...loc,
  }];
};

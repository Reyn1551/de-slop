import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Pure #000 / black page background — Material/Apple consensus prefers #121212-family.
// Warning (a11y/OLED-smear nuance, not an outright error).

const PURE_BLACK_BG =
  /(?:body|html|#root|:root|\.app|\.main|\.page)[^{}]{0,60}\{[^{}]*(?:background(?:-color)?\s*:\s*(?:#000\b|#000000|black|rgb\(0\s*,\s*0\s*,\s*0\)))[^}]*\}/gi;

const BLACK_CLASS =
  /\bbg-black\b/;

export const noPureBlackBg: DesignSlopRuleFn = (code, _filePath, locator) => {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  for (const hit of collectRegex(code, PURE_BLACK_BG)) {
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    findings.push({
      severity: 'warning',
      message: 'Pure #000/black page background — renders with OLED smear and kills shadows; use a #121212-family surface (Material/Apple consensus)',
      ...loc,
    });
  }

  for (const hit of collectRegex(code, BLACK_CLASS)) {
    // only flag bg-black when it is a page-level shell (matches a container with min-h-screen)
    const window = code.slice(Math.max(0, hit.index - 300), hit.index + 300);
    if (!/min-h-screen|h-screen|w-screen|fixed\s+inset|absolute\s+inset/.test(window)) continue;
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    findings.push({
      severity: 'warning',
      message: 'bg-black on a full-screen shell — use bg-neutral-950 / a surface token instead of pure black',
      ...loc,
    });
  }

  return findings;
};

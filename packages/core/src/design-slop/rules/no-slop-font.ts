import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Font rules — based on research:
// (1) single-font-page where that font is Inter = warning (no display hierarchy).
// (2) AI-converged display fonts used as headings = warning
//     (Space Grotesk, Geist, Instrument Serif, Fraunces, Syne, DM Sans).
// NOT flagged alone: Sora, Bricolage Grotesque, JetBrainsMono-as-code, Manrope, Poppins.
// Allowlist escape: font-feature-settings present on the family, or a font token variable.

// Matches `font-family: Inter, ...;` — Inter first in the list, quoted or not.
const INTER_SINGLE = /font-family\s*:\s*['"]?Inter['"]?\s*,/gi;

const DISPLAY_SLOP =
  /['"](?:Space\s+Grotesk|Geist|Instrument\s+Serif|Fraunces|Syne|DM\s+Sans)['"]/g;

const FEATURE_SETTINGS = /font-feature-settings\s*:/g;

const FONT_TOKEN = /--font-|fontFamily\s*:|theme\s*\(\s*--font/g;

export const noSlopFont: DesignSlopRuleFn = (code, filePath, locator) => {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
  const hasFeatureSettings = FEATURE_SETTINGS.test(code);
  const hasFontToken = FONT_TOKEN.test(code);

  for (const hit of collectRegex(code, INTER_SINGLE)) {
    if (hasFeatureSettings || hasFontToken) continue;
    // only the "everything is Inter" case — skip config files declaring a family list
    if (/tailwind\.config|theme\s*\.\s*extend|sans\s*:/.test(code)) continue;
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    findings.push({
      severity: 'warning',
      message: 'Inter as the single page font with no display hierarchy — AI default; pair with a distinctive display face or a token system + font-feature-settings',
      ...loc,
    });
  }

  const isHeadingContext = /\bh1\b|\bh2\b|\bfont-(?:display|heading)\b|display\s*:/i.test(code);
  for (const hit of collectRegex(code, DISPLAY_SLOP)) {
    if (!isHeadingContext && !/font-family/.test(code.slice(0, hit.index))) continue;
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    findings.push({
      severity: 'warning',
      message: `AI-converged display font (${hit.match}) — Space Grotesk/Geist/Instrument Serif/Fraunces/Syne/DM Sans are LLM defaults; pick a distinctive typeface`,
      ...loc,
    });
  }

  void filePath;
  return findings;
};

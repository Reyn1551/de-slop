import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Two font tells:
//   1. A page that uses one family for everything, and that family is Inter.
//   2. A display face LLMs converge on (Space Grotesk, Geist, Instrument Serif,
//      Fraunces, Syne, DM Sans) used for headings.
//
// "Single font" is checked properly now: the rule collects every declared
// family and only fires when Inter is the only one. A real display/body pair
// no longer trips it. Not flagged alone: Sora, Bricolage Grotesque, Manrope,
// Poppins, JetBrains Mono as a code face.

const FAMILY_DECLARATION =
  /font-family\s*:\s*([^;}\n]+)|fontFamily\s*:\s*([^,}\n]+)|--font-(?:sans|display|heading|body)\s*:\s*([^;}\n]+)/gi;

const DISPLAY_SLOP =
  /['"]?(Space\s+Grotesk|Geist|Instrument\s+Serif|Fraunces|Syne|DM\s+Sans)['"]?/gi;

const HEADING_CONTEXT = /\bh1\b|\bh2\b|\bfont-(?:display|heading)\b|display\s*:|--font-display/i;


const GENERIC_FALLBACK = /^(?:system-ui|-apple-system|sans-serif|ui-sans-serif|BlinkMacSystemFont|Segoe UI|Roboto|Helvetica Neue|Arial|Noto Sans)$/i;

function familiesOf(declaration: string): string[] {
  return declaration
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter((part) => part.length > 0 && !GENERIC_FALLBACK.test(part));
}

export const noSlopFont: DesignSlopRuleFn = (code, _filePath, locator) => {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  const declared: { family: string; index: number }[] = [];
  for (const match of code.matchAll(FAMILY_DECLARATION)) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    for (const family of familiesOf(value)) {
      declared.push({ family, index: match.index ?? 0 });
    }
  }

  const uniqueFamilies = new Set(declared.map((entry) => entry.family.toLowerCase()));
  const interEntry = declared.find((entry) => /^inter$/i.test(entry.family));
  // A project that declares font tokens or a theme fontFamily is choosing a
  // type system on purpose, so a single-family file is not the AI default.
  const declaresTypeSystem = /--font-[\w-]*\s*:/.test(code) || /fontFamily\s*:\s*\{/.test(code);
  if (interEntry && uniqueFamilies.size === 1 && !declaresTypeSystem) {
    findings.push({
      severity: 'warning',
      message: 'Inter is the only font in the project with no display face — AI default; pair it with a distinctive heading family or declare a type scale token',
      ...toColumn(locator.getLineAndCharacterOfPosition(interEntry.index)),
    });
  }

  const isHeadingContext = HEADING_CONTEXT.test(code);
  for (const hit of collectRegex(code, DISPLAY_SLOP)) {
    const before = code.slice(0, hit.index);
    const inFontDeclaration = /font-family\s*:\s*['"]?$/i.test(before.slice(-40));
    if (!isHeadingContext && !inFontDeclaration) continue;
    findings.push({
      severity: 'warning',
      message: `AI-converged display font (${hit.match.replace(/['"]/g, '')}) — Space Grotesk/Geist/Instrument Serif/Fraunces/Syne/DM Sans are LLM defaults; pick a distinctive typeface`,
      ...toColumn(locator.getLineAndCharacterOfPosition(hit.index)),
    });
  }

  return findings;
};

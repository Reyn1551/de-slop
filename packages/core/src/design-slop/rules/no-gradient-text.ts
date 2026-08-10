import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Gradient text via background-clip: text + color: transparent.
// Legit: logo wordmark, max 1-2 short emphasis words, with @supports fallback.
// Error when applied to long body copy (a11y fail), otherwise warning.

const CLIP_TEXT = /(?:-webkit-)?background-clip\s*:\s*text/g;
const TRANSPARENT_TEXT = /color\s*:\s*transparent/g;
const TAILWIND_CLIP = /\bbg-clip-text\b/g;
const GRADIENT =
  /(?:linear-gradient|radial-gradient|conic-gradient)|gradient-to-(?:r|br|b|bl|l|tl|t|tr)/g;

const LONG_COPY = /(p|paragraph|description|subtitle|content|body)-?[^{}]{0,80}\{(?:[^{}]{0,200}(?:background-clip|color:\s*transparent))[^}]*\}/gi;

export const noGradientText: DesignSlopRuleFn = (code, _filePath, locator) => {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  const clipHits = collectRegex(code, CLIP_TEXT);
  const tailwindClip = collectRegex(code, TAILWIND_CLIP);
  const gradientPresent = GRADIENT.test(code);
  const transparentPresent = TRANSPARENT_TEXT.test(code);
  const clipCount = clipHits.length + tailwindClip.length;

  if (clipCount === 0 || (!gradientPresent && !transparentPresent)) return [];

  const longCopy = collectRegex(code, LONG_COPY);
  const hasLongCopy = longCopy.length > 0;

  for (const hit of [...clipHits, ...tailwindClip]) {
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    findings.push({
      severity: hasLongCopy ? 'error' : 'warning',
      message: hasLongCopy
        ? 'Gradient-clipped text on body/long copy — unreadable (contrast cannot be verified, invisible in forced-colors); use solid text'
        : 'Gradient-clipped text (background-clip: text) — stock AI treatment; restrict to a logo wordmark or 1-2 emphasis words with @supports fallback',
      ...loc,
    });
  }

  return findings;
};

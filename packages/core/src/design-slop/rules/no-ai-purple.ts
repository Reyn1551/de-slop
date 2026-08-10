import type { DesignSlopRuleFn } from '../types';
import { countRegex, collectRegex, rawLocator, toColumn } from '../utils';

// VibeCode Purple band: hue 230-300°, captures indigo-500 #6366f1, indigo-600 #4f46e5,
// violet-600 #7c3aed, purple-600 #9333ea, purple-500 #a855f7, violet-500 #8b5cf6.
// Exemptions (brand-authentic purple, hue >= 290 or widely recognized):
//   #9146FF Twitch, #611F69 Slack, #5865F2 Discord, #635BFF Stripe, #5E5ADB Linear (hue 239 — handled via token block strip).
// Rule: warning when purple is used as primary accent (2+ occurrences or stock-hex-only),
//       error when stock purple hex + gradient coexist in the same file.

const HEX_PURPLE =
  /#(?:6366[fF]1|4[fF]46[eE]5|7[cC]3[aA][eE][dD]|9333[eE][aA]|a855[fF]7|8[bB]5[cC][fF]6|6[dD]28[dD]9|5[bB]21[bB]6|c084[fF][cC]|a78[bB][fF][aA])/g;

const EXEMPT_HEX =
  /#(?:9146[Ff][Ff]|611[Ff]69|5865[Ff]2|635[Ff][Ff]|5[eE]5[aA][dD][bB])/g;

const TAILWIND_PURPLE = /\b(?:bg|text|border|from|to|via|ring|shadow)-(?:indigo|purple|violet)-(?:400|500|600|700)\b/g;

const TOKEN_STRIP =
  /(?::root\s*{[^}]*}|\.\w*-purple\s*{[^}]*}|\.\w*-indigo\s*{[^}]*}|\.\w*-violet\s*{[^}]*})/g;

export const noAiPurple: DesignSlopRuleFn = (code, _filePath, locator) => {
  const stripped = code.replace(TOKEN_STRIP, '');
  const purpleHex = collectRegex(stripped, HEX_PURPLE).filter((m) => !EXEMPT_HEX.test(m.match));
  const tailwindHits = collectRegex(stripped, TAILWIND_PURPLE);

  const total = purpleHex.length + tailwindHits.length;
  if (total === 0) return [];

  const hasGradient =
    /gradient-to-|linear-gradient|from-|via-|to-/.test(stripped);

  const severity = hasGradient && total >= 2 ? 'error' : 'warning';
  const samples = [...purpleHex.map((m) => m.match), ...tailwindHits.map((m) => m.match)]
    .slice(0, 3)
    .join(', ');
  const idx = purpleHex[0]?.index ?? tailwindHits[0]?.index ?? 0;
  const loc = toColumn(locator.getLineAndCharacterOfPosition(idx));

  const message =
    severity === 'error'
      ? `AI-default purple/indigo palette (${samples}) combined with a gradient — stock AI design pattern; brand-authentic purples (Twitch #9146FF, Slack #611F69) are exempt`
      : `Purple/indigo palette (${samples}) used ${total}x as primary accent — common AI default; consider a distinctive brand color`;

  return [{ severity, message, ...loc }];
};

// re-export locator usage guard (keeps tree-shaking-friendly signature)
void rawLocator;
void countRegex;

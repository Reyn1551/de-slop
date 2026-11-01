import type { DesignSlopRuleFn } from '../types';
import { collectRegex, toColumn } from '../utils';

// Colored glow shadows (shadow-{color}/{alpha} or a box-shadow with a hue).
// Warning at 2+ elements. Focus rings are excluded by class token, not by a
// character window: the old ±200-character sweep silenced unrelated shadows
// near a focus ring and missed rings declared further away.

const GLOW_CLASS = /\bshadow-(?:indigo|purple|violet|blue|pink|cyan|emerald|teal|fuchsia|rose|amber|lime|green|red|orange)-(?:300|400|500|600)(?:\/[0-9]+)?\b/g;
const GLOW_DECLARATION =
  /box-shadow\s*:\s*[^;}]*(?:indigo|purple|violet|blue|pink|cyan|emerald|teal|fuchsia|rose|amber|lime|green|red|orange)[^;}]*/g;
const FOCUS_RING = /focus-visible:ring|focus:ring/g;

export const noGlowShadow: DesignSlopRuleFn = (code, _filePath, locator) => {
  const hits = [...collectRegex(code, GLOW_CLASS), ...collectRegex(code, GLOW_DECLARATION)]
    .filter((hit) => !FOCUS_RING.test(hit.match))
    .sort((a, b) => a.index - b.index);

  if (hits.length < 2) return [];

  const loc = toColumn(locator.getLineAndCharacterOfPosition(hits[0].index));
  return [{
    severity: 'warning',
    message: `${hits.length} colored glow shadows — AI depth default; use neutral shadows for depth, solid color for identity (hue-matched desaturated shadows are the legit alternative)`,
    ...loc,
  }];
};

import type { DesignSlopRuleFn } from '../types';
import { isExemptColor } from '../../design-contract/exemptions';
import { collectRegex, toColumn } from '../utils';

// Colored glow shadows (shadow-{color}/{alpha} or a box-shadow with a hue).
// Warning at 2+ elements. Focus rings are excluded by class token, not by a
// character window: the old ±200-character sweep silenced unrelated shadows
// near a focus ring and missed rings declared further away.

const GLOW_CLASS = /\bshadow-(?:indigo|purple|violet|blue|pink|cyan|emerald|teal|fuchsia|rose|amber|lime|green|red|orange)-(?:300|400|500|600)(?:\/[0-9]+)?\b/g;
const GLOW_DECLARATION =
  /box-shadow\s*:\s*[^;}]*(?:indigo|purple|violet|blue|pink|cyan|emerald|teal|fuchsia|rose|amber|lime|green|red|orange)[^;}]*/g;
const FOCUS_RING = /focus-visible:ring|focus:ring/g;

export const noGlowShadow: DesignSlopRuleFn = (code, _filePath, locator, contract) => {
  const hits = [...collectRegex(code, GLOW_CLASS), ...collectRegex(code, GLOW_DECLARATION)]
    .filter((hit) => !FOCUS_RING.test(hit.match))
    // A declared brand color used as a glow is a choice, not a default.
    .filter((hit) => {
      const hex = /#[0-9a-fA-F]{3,8}/.exec(hit.match)?.[0];
      return hex === undefined || !isExemptColor(contract ?? null, hex);
    })
    .sort((a, b) => a.index - b.index);

  if (hits.length < 2) return [];

  const loc = toColumn(locator.getLineAndCharacterOfPosition(hits[0].index));
  return [{
    severity: 'warning',
    message: `${hits.length} colored glow shadows — AI depth default; use neutral shadows for depth, solid color for identity (hue-matched desaturated shadows are the legit alternative)`,
    ...loc,
  }];
};

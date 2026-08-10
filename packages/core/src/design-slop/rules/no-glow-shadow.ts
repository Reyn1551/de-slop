import type { DesignSlopRuleFn } from '../types';
import { collectRegex, toColumn } from '../utils';

// Colored glow shadows (shadow-{color}/{alpha} or shadow with hue) — warning when 2+ elements.
// Exclude focus-visible:ring-* (legit) and inset shadows.

const GLOW_SHADOW =
  /(?:box-shadow\s*:\s*[^;]*(?:indigo|purple|violet|blue|pink|cyan|emerald|teal|fuchsia|rose)[^;]*;)|shadow-(?:indigo|purple|violet|blue|pink|cyan|emerald|teal|fuchsia|rose)-(?:400|500|600)(?:\/[0-9]+)?/g;

const FOCUS_RING = /focus-visible\s*:\s*ring/g;

export const noGlowShadow: DesignSlopRuleFn = (code, _filePath, locator) => {
  const focusHits = collectRegex(code, FOCUS_RING);
  const focusIndexes = new Set<number>();
  for (const f of focusHits) {
    // block out the region containing the focus ring
    for (let i = Math.max(0, f.index - 200); i <= f.index + 200; i++) focusIndexes.add(i);
  }

  const glowHits = collectRegex(code, GLOW_SHADOW).filter((h) => !focusIndexes.has(h.index));
  if (glowHits.length < 2) return [];

  const loc = toColumn(locator.getLineAndCharacterOfPosition(glowHits[0].index));
  return [{
    severity: 'warning',
    message: `${glowHits.length} colored glow shadows — AI depth default; use neutral shadows for depth, solid color for identity (Josh Comeau: hue-matched desaturated shadows are the legit alternative)`,
    ...loc,
  }];
};

import type { DesignSlopRuleFn } from '../types';
import { toColumn } from '../utils';

// Animated gradient blobs: blur-2xl/3xl + rounded-full + translucent color.
// Warning standalone; error when that same element also animates and the file
// carries no reduced-motion guard. Animation is checked on the blob's own
// className, not file-wide: a spinner elsewhere in the file used to escalate
// every static blob.

const CLASSNAME = /["'`]([^"'`]*?(?:rounded-full|blur-(?:2xl|3xl))[^"'`]*)["'`]/g;

const BLUR = /\bblur-(?:2xl|3xl)\b/;
const ROUNDED = /\brounded-full\b/;
const COLORED_BG = /\b(?:bg|from|to|via)-(?:indigo|purple|violet|blue|pink|cyan|emerald|teal|fuchsia|rose)-[0-9]+(?:\/[0-9]+)?\b/;
const ANIMATION = /\banimate-(?:\[[^\]]+\]|[a-z][\w-]*)/;

const REDUCED_MOTION = /prefers-reduced-motion|motion-reduce:/;

export const noGradientBlob: DesignSlopRuleFn = (code, _filePath, locator) => {
  const blobs: { index: number; animated: boolean }[] = [];
  for (const match of code.matchAll(CLASSNAME)) {
    const className = match[1];
    if (!BLUR.test(className) || !ROUNDED.test(className) || !COLORED_BG.test(className)) continue;
    blobs.push({ index: match.index ?? 0, animated: ANIMATION.test(className) });
  }
  if (blobs.length === 0) return [];

  const animatedBlobs = blobs.filter((blob) => blob.animated);
  const unguarded = animatedBlobs.length > 0 && !REDUCED_MOTION.test(code);
  const anchor = (unguarded ? animatedBlobs[0] : blobs[0]).index;
  const loc = toColumn(locator.getLineAndCharacterOfPosition(anchor));

  return [{
    severity: unguarded ? 'error' : 'warning',
    message: unguarded
      ? `${animatedBlobs.length} animated gradient blob(s) without a prefers-reduced-motion guard — the signature AI hero cliché; add motion-reduce: or remove the animation`
      : `${blobs.length} decorative gradient blob(s) (blur + rounded-full) — AI hero background cliché; a single slow static gradient or real imagery reads more intentional`,
    ...loc,
  }];
};

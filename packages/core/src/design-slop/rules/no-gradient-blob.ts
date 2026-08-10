import type { DesignSlopRuleFn } from '../types';
import { toColumn } from '../utils';

// Animated gradient blobs: blur-2xl/3xl + rounded-full + translucent color + infinite animation.
// Warning standalone; contributes to bundle. Must check for prefers-reduced-motion guard.
// Matched on whole className strings so bg-before-blur order does not matter.

const CLASSNAME = /["'`]([^"'`]*?(?:rounded-full|blur-(?:2xl|3xl))[^"'`]*)["'`]/g;

const BLUR = /\bblur-(?:2xl|3xl)\b/;
const ROUNDED = /\brounded-full\b/;
const COLORED_BG = /\b(?:bg|from|to|via)-(?:indigo|purple|violet|blue|pink|cyan|emerald|teal|fuchsia|rose)-[0-9]+\//;

const ANIMATE_INFINITE =
  /animate-\[?[a-z]+[^\]"';{}]*(?:infinite)?|@keyframes\s+(?:blob|float|pulse|drift|aurora)/g;

const REDUCED_MOTION =
  /prefers-reduced-motion|motion-reduce:/g;

export const noGradientBlob: DesignSlopRuleFn = (code, _filePath, locator) => {
  const blobIndexes: number[] = [];
  for (const m of code.matchAll(CLASSNAME)) {
    const cls = m[1];
    if (BLUR.test(cls) && ROUNDED.test(cls) && COLORED_BG.test(cls)) {
      blobIndexes.push(m.index ?? 0);
    }
  }
  if (blobIndexes.length === 0) return [];

  const hasAnimation = ANIMATE_INFINITE.test(code);
  const hasReducedMotionGuard = REDUCED_MOTION.test(code);

  const loc = toColumn(locator.getLineAndCharacterOfPosition(blobIndexes[0]));
  const animated = hasAnimation && !hasReducedMotionGuard;
  return [{
    severity: animated ? 'error' : 'warning',
    message: animated
      ? `${blobIndexes.length} animated gradient blob(s) without prefers-reduced-motion guard — the signature AI hero cliché; add motion-reduce: or remove the animation`
      : `${blobIndexes.length} decorative gradient blob(s) (blur + rounded-full) — AI hero background cliché; a single slow static gradient or real imagery reads more intentional`,
    ...loc,
  }];
};

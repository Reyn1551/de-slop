import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Stock gradient button combos that LLMs converge on (from Tailwind UI demos).
// A stock recipe is an error only when it sits on a button-ish element: the
// same recipe on a hero section is a different (and often deliberate) choice.
// Generic gradients stay warnings inside a button scope.

const STOCK_RECIPES = [
  /from-indigo-500\s+to-purple-600/g,
  /from-indigo-600\s+(?:via-[a-z]+-[0-9]+\s+)?to-purple-600/g,
  /from-blue-600\s+to-indigo-700/g,
  /from-violet-600\s+via-purple-600\s+to-indigo-(?:700|900)/g,
  /from-blue-600\s+via-indigo-500\s+to-purple-600/g,
  /from-indigo-600\s+via-purple-600\s+to-pink-500/g,
  /from-violet-500\s+to-purple-500/g,
];

const GENERIC_GRADIENT =
  /(?:bg-gradient-to-[rbl]|bg-linear-to-[rbl]|linear-gradient\([^)]*(?:indigo|purple|violet|blue)[^)]*\))/g;

const BUTTON_TAG = /<(button|Button|a)\b[^<>]*>/g;
const BUTTON_CSS_BLOCK = /\.(?:btn|button)[\w-]*[^{}]{0,60}\{[^{}]*\}/gi;

const IS_BUTTON_CLASS = /\b(?:btn|button|cta)\b/i;
// An anchor with both axes of padding is a button in everything but the tag.
const CTA_PADDING = /\bpx-\S/;
const CTA_PADDING_Y = /\bpy-\S/;

/** Character spans of button-ish elements, used to scope recipe hits. */
function buttonRegions(code: string): { start: number; end: number }[] {
  const regions: { start: number; end: number }[] = [];

  for (const match of code.matchAll(BUTTON_TAG)) {
    const start = match.index ?? 0;
    const tagName = match[1];
    const className = /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/.exec(match[0]);
    const classes = className?.[1] ?? className?.[2] ?? className?.[3] ?? '';

    const looksLikeButton =
      tagName !== 'a' ||
      IS_BUTTON_CLASS.test(classes) ||
      (CTA_PADDING.test(classes) && CTA_PADDING_Y.test(classes));
    if (!looksLikeButton) continue;

    const close = code.indexOf('</', start);
    regions.push({ start, end: close === -1 ? start + 400 : close });
  }

  for (const match of code.matchAll(BUTTON_CSS_BLOCK)) {
    const start = match.index ?? 0;
    regions.push({ start, end: start + match[0].length });
  }

  return regions;
}

export const noGradientButton: DesignSlopRuleFn = (code, _filePath, locator) => {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
  const regions = buttonRegions(code);
  const inButton = (index: number): boolean =>
    regions.some((region) => index >= region.start && index < region.end);

  const seen = new Set<number>();
  for (const recipe of STOCK_RECIPES) {
    for (const hit of collectRegex(code, recipe)) {
      if (seen.has(hit.index)) continue;
      seen.add(hit.index);
      const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
      const scoped = inButton(hit.index);
      findings.push({
        severity: scoped ? 'error' : 'warning',
        message: scoped
          ? `Stock AI gradient button (${hit.match}) — exact Tailwind/v0/Bolt default recipe; use a solid brand-derived button instead`
          : `Stock AI gradient (${hit.match}) — exact Tailwind/v0/Bolt default recipe; if this is a button, use a solid brand color`,
        ...loc,
      });
    }
  }

  for (const hit of collectRegex(code, GENERIC_GRADIENT)) {
    if (seen.has(hit.index)) continue;
    if (!inButton(hit.index)) continue;
    seen.add(hit.index);
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    findings.push({
      severity: 'warning',
      message: 'Gradient button fill — Stripe/Linear use solid buttons with gradients reserved for the hero; prefer solid',
      ...loc,
    });
  }

  return findings;
};

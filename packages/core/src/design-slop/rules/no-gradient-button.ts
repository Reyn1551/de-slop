import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Stock gradient button combos that LLMs converge on (from Tailwind UI demos).
// Exact stock recipes = error. Any generic gradient on a button-ish selector = warning.

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
  /(?:bg-gradient-to-[rbl]|linear-gradient\([^)]*(?:indigo|purple|violet|blue)[^)]*\))/g;

const BUTTON_SCOPE =
  /\.btn[^{}]{0,60}\{[^{}]*(?:gradient-to|linear-gradient)[^}]*\}|className=["'][^"']*gradient[^"']*(?:button|btn)[^"']*["']/gi;

export const noGradientButton: DesignSlopRuleFn = (code, _filePath, locator) => {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  const seen = new Set<number>();
  for (const recipe of STOCK_RECIPES) {
    for (const hit of collectRegex(code, recipe)) {
      if (seen.has(hit.index)) continue;
      seen.add(hit.index);
      const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
      findings.push({
        severity: 'error',
        message: `Stock AI gradient button (${hit.match}) — exact Tailwind/v0/Bolt default recipe; use a solid brand-derived button instead`,
        ...loc,
      });
    }
  }

  for (const hit of collectRegex(code, GENERIC_GRADIENT)) {
    if (seen.has(hit.index)) continue;
    const inButtonScope = BUTTON_SCOPE.test(code);
    if (!inButtonScope) continue;
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

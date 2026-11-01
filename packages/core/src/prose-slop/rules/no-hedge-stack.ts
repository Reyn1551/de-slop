import type { ProseFinding, ProseRuleFn } from '../types';
import { collect } from '../mask';
import { report } from '../utils';

// humanizer §9 — one qualifier stacked on another until the claim dissolves.
const HEDGE_STACK = [
  /\bcould\s+(?:potentially|possibly|conceivably)\b/gi,
  /\bmight\s+(?:possibly|potentially|arguably)\b/gi,
  /\b(?:it\s+)?could\s+be\s+argued\s+that\b/gi,
  /\bit'?s\s+(?:also\s+)?possible\s+that\b/gi,
  /\bin\s+some\s+cases\s+it\s+may\b/gi,
  /\b(?:to\s+be\s+fair|it\s+should\s+be\s+noted)\b/gi,
];

export const noHedgeStack: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  for (const pattern of HEDGE_STACK) {
    for (const hit of collect(context.text, pattern)) {
      findings.push(
        report(context, hit.index, 'warning', `Stacked qualifier ("${hit.match.trim()}") — say what you know`),
      );
    }
  }
  return findings;
};

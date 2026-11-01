import type { ProseFinding, ProseRuleFn } from '../types';
import { collect } from '../mask';
import { report } from '../utils';

// humanizer §16 — the text reads like an advertisement.
const SALES = [
  /\bnestled\s+(?:in|within|between)\b/gi,
  /\bbreathtaking\b/gi,
  /\bmust-visit\b/gi,
  /\bgame-?changer\b/gi,
  /\bseamless(?:ly)?\b/gi,
  /\bunlock\s+the\s+(?:power|potential)\b/gi,
  /\bcutting-edge\b/gi,
  /\bstate-of-the-art\b/gi,
  /\brevolutionary\b/gi,
  /\bworld-class\b/gi,
  /\bbest-in-class\b/gi,
  /\beffortless(?:ly)?\b/gi,
  /\bsupercharge[sd]?\b/gi,
  /\bempower(?:s|ed|ing)?\b/gi,
];

export const noSalesLanguage: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  for (const pattern of SALES) {
    for (const hit of collect(context.text, pattern)) {
      findings.push(
        report(context, hit.index, 'warning', `Sales language ("${hit.match.trim()}") — state what the thing does`),
      );
    }
  }
  return findings;
};

import type { ProseFinding, ProseRuleFn } from '../types';
import { collect } from '../mask';
import { report } from '../utils';

// humanizer §13 — an ordinary fact dressed as a turning point.
const INFLATED = [
  /\bstands?\s+as\s+a\s+testament\b/gi,
  /\ba\s+testament\s+to\b/gi,
  /\b(?:a\s+)?pivotal\s+(?:moment|role|point)\b/gi,
  /\bplays?\s+a\s+(?:key|crucial|vital)\s+role\b/gi,
  /\bunderscor(?:es|ing)\s+(?:its|the)\s+importance\b/gi,
  /\b(?:evolving|ever-changing|ever-evolving)\s+landscape\b/gi,
  /\bsetting\s+the\s+stage\s+for\b/gi,
  /\bleaves?\s+an\s+indelible\s+mark\b/gi,
  /\bthe\s+future\s+looks\s+bright\b/gi,
  /\bexciting\s+times\s+(?:lie\s+)?ahead\b/gi,
  /\ba\s+step\s+in\s+the\s+right\s+direction\b/gi,
  /\b(?:continues|continue)\s+to\s+thrive\b/gi,
  /\bmarks?\s+a\s+(?:new|major|significant)\s+(?:era|chapter|milestone)\b/gi,
];

export const noInflatedSignificance: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  for (const pattern of INFLATED) {
    for (const hit of collect(context.text, pattern)) {
      findings.push(
        report(
          context,
          hit.index,
          'warning',
          `Inflated significance ("${hit.match.trim()}") — keep the fact, drop the significance`,
        ),
      );
    }
  }
  return findings;
};

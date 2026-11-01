import type { ProseFinding, ProseRuleFn } from '../types';
import { collect } from '../mask';
import { report } from '../utils';

// humanizer §3 — an ordinary point dressed as a hidden truth.
const FAKE_DEPTH = [
  /\bthe\s+real\s+question\s+is\b/gi,
  /\bat\s+its\s+core\b/gi,
  /\bin\s+reality\b/gi,
  /\bwhat\s+really\s+matters\b/gi,
  /\bfundamentally\b/gi,
  /\bthe\s+deeper\s+(?:issue|problem|question)\b/gi,
  /\bthe\s+heart\s+of\s+the\s+matter\b/gi,
  /\bis\s+the\s+(?:language|currency|architecture)\s+of\b/gi,
  /\bbecomes\s+a\s+trap\b/gi,
  /\bis\s+not\s+a\s+tool\s+but\s+a\s+mirror\b/gi,
  /\bpada\s+intinya\b/gi,
  /\byang\s+sebenarnya\s+penting\b/gi,
];

export const noFakeDepth: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  for (const pattern of FAKE_DEPTH) {
    for (const hit of collect(context.text, pattern)) {
      findings.push(
        report(
          context,
          hit.index,
          'warning',
          `Fake depth ("${hit.match.trim()}") — replace the saying with the specific claim`,
        ),
      );
    }
  }
  return findings;
};

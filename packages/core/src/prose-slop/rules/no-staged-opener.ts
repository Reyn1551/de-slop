import type { ProseFinding, ProseRuleFn } from '../types';
import { collect } from '../mask';
import { report } from '../utils';

// humanizer §4 — announcing the point instead of making it.
const STAGED = [
  /\blet'?s\s+(?:dive|jump|dig)\s+(?:in|into)\b/gi,
  /\blet'?s\s+(?:explore|break\s+this\s+down|take\s+a\s+look)\b/gi,
  /\bhere'?s\s+what\s+you\s+need\s+to\s+know\b/gi,
  /\bwithout\s+further\s+ado\b/gi,
  /\bnow\s+let'?s\s+(?:look|move|turn)\b/gi,
  /\b(?:quick\s+note|heads\s+up|real\s+talk)\s*[:,]/gi,
  /\bhere'?s\s+the\s+thing\b/gi,
  /\bmari\s+kita\s+(?:bahas|bedah|lihat|telusuri)\b/gi,
  /\bberikut\s+adalah\s+penjelasan(?:nya)?\b/gi,
];

export const noStagedOpener: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  for (const pattern of STAGED) {
    for (const hit of collect(context.text, pattern)) {
      findings.push(
        report(context, hit.index, 'warning', `Staged opener ("${hit.match.trim()}") — cut the run-up and start with the claim`),
      );
    }
  }
  return findings;
};

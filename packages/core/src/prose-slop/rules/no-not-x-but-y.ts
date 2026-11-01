import type { ProseFinding, ProseRuleFn } from '../types';
import { collect } from '../mask';
import { report } from '../utils';

// humanizer §1 — the strongest tell. The negative half names something nobody
// claimed, so the positive half sounds larger without adding a claim.
const NOT_X_BUT_Y = [
  /\bnot\s+(?:just|only|merely|simply)\b[^.!?\n]{1,80}\bbut\b/gi,
  /\b(?:it|this|that)(?:'s|\s+is)\s+not\s+(?:just|only|merely|simply|about)\b[^.!?]{1,80}[.!?]\s*(?:it|this|that)(?:'s|\s+is)\b/gi,
  /\b(?:is|are|was|were)n'?t\s+(?:just|only|merely|simply|about)\b[^.!?]{1,80}[.!?]\s*(?:it|this|that)(?:'s|\s+is)\b/gi,
  /\b(?:it|this|that)(?:'s|\s+is)\s+not\s+[^.!?\n]{1,60},\s*(?:it|this|that)(?:'s|\s+is)\b/gi,
  /\brather\s+than\b[^.!?\n]{1,60}\b(?:it|this|that)\b/gi,
  /\bbukan\s+(?:hanya|sekadar|sekedar)\b[^.!?\n]{1,80}\b(?:tetapi|tapi|melainkan)\b/gi,
];

export const noNotXButY: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  const seen = new Set<number>();
  for (const pattern of NOT_X_BUT_Y) {
    for (const hit of collect(context.text, pattern)) {
      if (seen.has(hit.index)) continue;
      seen.add(hit.index);
      findings.push(
        report(
          context,
          hit.index,
          'warning',
          `Not-X-but-Y contrast ("${hit.match.trim().slice(0, 60)}") — the negative half names a claim nobody made; state the point directly`,
        ),
      );
    }
  }
  return findings;
};

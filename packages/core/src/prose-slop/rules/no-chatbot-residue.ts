import type { ProseFinding, ProseRuleFn } from '../types';
import { collect } from '../mask';
import { report } from '../utils';

// humanizer §22 — the most certain tell and the easiest to miss.
const RESIDUE = [
  /\bI\s+hope\s+this\s+helps\b/gi,
  /\b(?:great|excellent|good)\s+question\b/gi,
  /\b(?:of\s+)?course!|\bcertainly!|\bsure\s+thing!/gi,
  /\blet\s+me\s+know\s+if\b/gi,
  /\bwould\s+you\s+like\s+(?:me\s+to|to)\b/gi,
  /\bshould\s+I\s+(?:continue|go\s+on|expand)\b/gi,
  /\bfeel\s+free\s+to\s+(?:ask|reach\s+out)\b/gi,
  /\bI'?m\s+happy\s+to\s+help\b/gi,
  /\bas\s+an\s+AI\s+(?:language\s+)?model\b/gi,
];

export const noChatbotResidue: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  for (const pattern of RESIDUE) {
    for (const hit of collect(context.text, pattern)) {
      findings.push(
        report(
          context,
          hit.index,
          'error',
          `Chatbot residue ("${hit.match.trim()}") — remove the wrapper and keep the content`,
        ),
      );
    }
  }
  return findings;
};

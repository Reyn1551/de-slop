import type { ProseFinding, ProseRuleFn } from '../types';
import { report } from '../utils';

// humanizer §2 — a short paragraph that restates the point instead of adding one.
const CLOSERS = [
  /^that'?s the real (?:win|point|lesson)\.?$/i,
  /^that distinction matters\.?$/i,
  /^let that sink in\.?$/i,
  /^read that again\.?$/i,
  /^this is the (?:whole|entire) point\.?$/i,
  /^that is the whole point\.?$/i,
];

const MAX_CLOSER_WORDS = 9;

export const noCloserLine: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];

  for (const paragraph of context.paragraphs) {
    const words = paragraph.text.trim().split(/\s+/);
    if (words.length > MAX_CLOSER_WORDS) continue;
    if (!CLOSERS.some((pattern) => pattern.test(paragraph.text.trim()))) continue;
    findings.push(
      report(
        context,
        paragraph.start,
        'warning',
        `One-line closer ("${paragraph.text.trim()}") — cut it or add a fact the previous paragraph did not have`,
      ),
    );
  }

  return findings;
};

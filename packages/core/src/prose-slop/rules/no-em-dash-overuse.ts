import type { ProseFinding, ProseRuleFn } from '../types';
import { collect } from '../mask';
import { report } from '../utils';

// humanizer §8. A dash lets the writer skip choosing how two clauses relate.
// One dash is fine; a document that leans on them is not.
const DASH = /—|–|\s--\s/g;
const DASHES_PER_100_WORDS_CEILING = 0.8;
const MINIMUM_DASHES = 3;
const MINIMUM_WORDS = 40;

export const noEmDashOveruse: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  const hits = collect(context.text, DASH);
  const words = context.words.length;
  if (hits.length < MINIMUM_DASHES || words < MINIMUM_WORDS) return findings;

  const perHundred = (hits.length / words) * 100;
  if (perHundred <= DASHES_PER_100_WORDS_CEILING) return findings;

  const excess = hits[Math.floor(hits.length / 2)];
  findings.push(
    report(
      context,
      excess.index,
      'warning',
      `${hits.length} dashes in ${words} words (${perHundred.toFixed(1)} per 100) — replace each with a period, comma, colon, or parentheses`,
    ),
  );
  return findings;
};

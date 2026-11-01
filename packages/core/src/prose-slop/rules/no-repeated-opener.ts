import type { ProseFinding, ProseRuleFn } from '../types';
import { report } from '../utils';

// humanizer §7 — several sentences in a row start with the same subject because
// repetition is handled by rule instead of by ear.
const MINIMUM_RUN = 3;
const STOP_OPENERS: Record<string, true> = {
  the: true,
  a: true,
  an: true,
  it: true,
  this: true,
  that: true,
  i: true,
  you: true,
  we: true,
};

export const noRepeatedOpener: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  const sentences = context.sentences;
  if (sentences.length < MINIMUM_RUN) return findings;

  let run = 1;
  for (let index = 1; index < sentences.length; index += 1) {
    const previous = opener(sentences[index - 1].text);
    const current = opener(sentences[index].text);
    if (previous !== null && previous === current && STOP_OPENERS[previous] !== true) {
      run += 1;
      if (run === MINIMUM_RUN) {
        findings.push(
          report(
            context,
            sentences[index].start,
            'warning',
            `${run} sentences in a row open with "${current}" — vary the openings or merge them`,
          ),
        );
      }
    } else {
      run = 1;
    }
  }

  return findings;
};

function opener(sentence: string): string | null {
  const match = /^([A-Za-z][A-Za-z'-]*)\b/.exec(sentence.trim());
  return match ? match[1].toLowerCase() : null;
}

import type { ProseFinding, ProseRuleFn } from '../types';
import { collect } from '../mask';
import { report } from '../utils';

// humanizer §12. Words that read as AI wherever they appear. Technical senses of
// `robust`, `leverage`, and `landscape` are left out on purpose: they are normal
// engineering vocabulary and flagging them trains people to ignore the rule.
const AI_WORDS =
  /\b(?:delve[sd]?|delving|tapestry|testament|meticulous(?:ly)?|intricate|intricacies|pivotal|showcas(?:e|es|ed|ing)|underscore[sd]?|garner(?:s|ed|ing)?|bolster(?:s|ed|ing)?|interplay|myriad|realm|vibrant|enduring|elevate[sd]?|unleash(?:es|ed|ing)?|embark(?:s|ed|ing)?|harness(?:es|ed|ing)?|paradigm|synerg(?:y|ies))\b/gi;

export const noAiVocabulary: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  const hits = collect(context.text, AI_WORDS);
  if (hits.length === 0) return findings;

  const seen = new Set<string>();
  for (const hit of hits) {
    const word = hit.match.toLowerCase().replace(/(?:es|s|ed|ing|d)$/, '');
    if (seen.has(word)) continue;
    seen.add(word);
    findings.push(
      report(
        context,
        hit.index,
        'warning',
        `AI vocabulary ("${hit.match}") — pick the plain word a person would say`,
      ),
    );
  }
  return findings;
};

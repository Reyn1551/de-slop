import type { ProseFinding, ProseRuleFn } from '../types';
import { report } from '../utils';

// humanizer §17 — an unnamed authority stands in for what was said.
const VAGUE = /\b(?:experts|researchers|scientists|analysts|studies|research|industry\s+reports|observers|critics|many\s+developers)\s+(?:say|says|show|shows|suggest|suggests|agree|agrees|argue|argues|believe|believes|prove|proves|confirm|confirms)\b/gi;

export const noVagueAttribution: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  const pattern = new RegExp(VAGUE.source, 'gi');
  for (const match of context.text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const paragraph = context.paragraphs.find((span) => span.start <= index && index < span.start + span.text.length);
    const rawParagraph = paragraph
      ? context.raw.slice(paragraph.start, paragraph.start + paragraph.text.length)
      : '';
    if (/https?:\/\/|\]\(/.test(rawParagraph)) continue;
    findings.push(
      report(
        context,
        index,
        'warning',
        `Vague attribution ("${match[0].trim()}") — name the source or cut the claim`,
      ),
    );
  }
  return findings;
};

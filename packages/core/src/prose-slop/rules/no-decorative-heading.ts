import type { ProseFinding, ProseRuleFn } from '../types';
import { report } from '../utils';

// humanizer §20 — headings and list items decorated instead of named.
// The H1 is a document title and often a brand or proper-noun phrase, so the
// rule judges subheadings only.
const DECORATION = /^#{1,6}\s.*(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]|→|⇒|▶)/u;

function isTitleCase(heading: string): boolean {
  const words = heading.replace(/^#+\s*/, '').split(/\s+/).filter((word) => /^[a-zA-Z]/.test(word));
  if (words.length < 4) return false;
  const capitalized = words.filter((word) => /^[A-Z]/.test(word)).length;
  return capitalized / words.length >= 0.8;
}

export const noDecorativeHeading: ProseRuleFn = (context) => {
  const findings: ProseFinding[] = [];
  const lines = context.text.split('\n');
  let offset = 0;

  for (const line of lines) {
    const heading = /^(#{1,6})\s/.exec(line);
    if (heading) {
      if (DECORATION.test(line)) {
        findings.push(
          report(context, offset, 'warning', `Decorative heading ("${line.trim().slice(0, 50)}") — drop the emoji or arrow`),
        );
      } else if (heading[1].length >= 2 && isTitleCase(line)) {
        findings.push(
          report(context, offset, 'warning', `Title Case heading ("${line.trim().slice(0, 50)}") — use sentence case`),
        );
      }
    }
    offset += line.length + 1;
  }

  return findings;
};

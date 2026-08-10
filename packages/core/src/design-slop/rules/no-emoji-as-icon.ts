import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Emoji as UI icons (🚀 ✨ 🎉 in buttons/badges/feature lists) is a top AI tell
// (wasitvibed "Emoji as Icons", Vibe extension "excessive emoji", aitoolpick).
// Scope carefully to avoid flagging real user content or docs:
//   - only fires when the emoji sits right after a JSX opening tag or
//     inside a pill/badge/button, i.e. an icon slot, not body copy.
//   - does NOT fire on emoji inside strings assigned to content variables,
//     markdown bodies, or text paragraphs.

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

const JSX_ICON_SLOT = /<(?:[A-Z]\w*|button|span|div)\b[^>]*>\s*[ \t]*\n?\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;

const PILL_CONTENT = /<(?:Badge|button|span|div)\b[^>]*(?:rounded-full|text-xs|px-)[^>]*>[\s\S]{0,80}[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;

export const noEmojiAsIcon: DesignSlopRuleFn = (code, filePath, locator) => {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  // exclude markdown / content-heavy files: emoji is legitimate there
  if (/\.(?:md|mdx|txt|rst)$/i.test(filePath)) return findings;

  const seen = new Set<number>();
  for (const hit of collectRegex(code, JSX_ICON_SLOT)) {
    if (seen.has(hit.index)) continue;
    seen.add(hit.index);
    // skip if this is body copy (a long sentence after the emoji), not an icon slot
    const after = code.slice(hit.index, hit.index + 120);
    if (/\p{Letter}{12,}/u.test(after)) continue;
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    findings.push({
      severity: 'warning',
      message: `Emoji used as a UI icon (${EMOJI.exec(hit.match)?.[0] ?? 'emoji'}) in an icon slot — AI tell (wasitvibed "Emoji as Icons"); use a proper icon set (lucide, phosphor, inline SVG) instead`,
      ...loc,
    });
  }

  const seenPill = new Set<number>();
  for (const hit of collectRegex(code, PILL_CONTENT)) {
    if (seenPill.has(hit.index)) continue;
    seenPill.add(hit.index);
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    findings.push({
      severity: 'warning',
      message: 'Emoji in a pill/badge icon slot — AI tell; replace with an icon component',
      ...loc,
    });
  }

  return findings;
};

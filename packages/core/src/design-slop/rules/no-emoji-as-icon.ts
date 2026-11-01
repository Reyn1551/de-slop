import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Emoji as UI icons (🚀 ✨ 🎉 in buttons, badges, feature lists) is a top AI tell.
//
// Scope is deliberate: only an icon slot counts — an emoji right after a JSX
// opening tag, or inside a pill/badge/button. Body copy, markdown, and emoji in
// a content string stay clean.
//
// The character class uses Emoji_Presentation so text-presentation symbols
// (arrows, checkbox marks, ©) and regional-indicator flags do not trip the
// rule; those appear in real product UI.

const REGIONAL_INDICATOR = /[\u{1F1E6}-\u{1F1FF}]/u;

const ICON_SLOT =
  /<(?:[A-Z]\w*|button|span|div)\b[^>]*>\s*\n?\s*([\p{Emoji_Presentation}])/gu;

const PILL_CONTENT =
  /<(?:Badge|button|span|div)\b[^>]*(?:rounded-full|text-xs|px-)[^>]*>[\s\S]{0,80}?([\p{Emoji_Presentation}])/gu;

const WORDY_AFTER = /\p{Letter}{12,}/u;

export const noEmojiAsIcon: DesignSlopRuleFn = (code, filePath, locator) => {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
  if (/\.(?:md|mdx|markdown|txt|rst|adoc)$/i.test(filePath)) return findings;

  const seen = new Set<number>();
  for (const hit of collectRegex(code, ICON_SLOT)) {
    const emoji = hit.match.slice(-2);
    if (REGIONAL_INDICATOR.test(hit.match)) continue;
    if (seen.has(hit.index)) continue;
    // Body copy after an emoji is a sentence, not an icon slot.
    if (WORDY_AFTER.test(code.slice(hit.index, hit.index + 120))) continue;
    seen.add(hit.index);
    findings.push({
      severity: 'warning',
      message: `Emoji used as a UI icon (${emoji}) in an icon slot — AI tell; use an icon set (lucide, phosphor, inline SVG) instead`,
      ...toColumn(locator.getLineAndCharacterOfPosition(hit.index)),
    });
  }

  for (const hit of collectRegex(code, PILL_CONTENT)) {
    if (REGIONAL_INDICATOR.test(hit.match)) continue;
    if (seen.has(hit.index)) continue;
    seen.add(hit.index);
    findings.push({
      severity: 'warning',
      message: 'Emoji in a pill or badge icon slot — AI tell; replace it with an icon component',
      ...toColumn(locator.getLineAndCharacterOfPosition(hit.index)),
    });
  }

  return findings;
};


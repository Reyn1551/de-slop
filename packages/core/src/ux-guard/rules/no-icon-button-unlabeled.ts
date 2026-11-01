import type { UxFinding, UxRuleFn } from '../types';
import { collectTags, elementBody, finding } from '../utils';

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
const VISIBLE_TEXT = /[\p{L}\p{N}]/u;
const ICON = /<svg\b|<[A-Z]\w*/u;

export const noIconButtonUnlabeled: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  for (const { tag, index, name } of collectTags(code)) {
    if (name !== 'button') continue;
    if (/(?:^|\s)(?:aria-label|aria-labelledby|title)\s*=/.test(tag)) continue;

    const body = elementBody(code, index, name);
    const text = body
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\{[^{}]*\}/g, '')
      .trim();
    if (VISIBLE_TEXT.test(text)) continue;
    if (!(body.trim() === '' || ICON.test(body) || EMOJI.test(body))) continue;

    findings.push(
      finding(
        locator,
        index,
        'error',
        'Icon-only <button> has no accessible name — add aria-label, aria-labelledby, or title; screen readers otherwise announce only "button"',
      ),
    );
  }
  return findings;
};

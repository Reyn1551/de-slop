import type { UxFinding, UxRuleFn } from '../types';
import { collectTags, finding } from '../utils';

export const noPlaceholderLabel: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  const lines = code.split('\n');
  for (const { tag, index, name } of collectTags(code)) {
    if (name !== 'input') continue;
    if (!/(?:^|\s)placeholder\s*=/.test(tag)) continue;
    if (/(?:^|\s)(?:aria-label|aria-labelledby|id)\s*=/.test(tag)) continue;

    const position = locator.getLineAndCharacterOfPosition(index);
    const nearby = lines.slice(Math.max(0, position.line - 3), position.line + 4).join('\n');
    if (/<label\b/.test(nearby)) continue;

    findings.push(
      finding(
        locator,
        index,
        'error',
        'Input relies on placeholder text as its only label — placeholders vanish once typed and are not reliably announced; add a <label>, aria-label, or aria-labelledby (WCAG 3.3.2)',
      ),
    );
  }
  return findings;
};

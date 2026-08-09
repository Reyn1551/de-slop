import type { Diagnostic } from '../../slop-scanner/types';

type Locator = { getLineAndCharacterOfPosition(pos: number): { line: number; character: number } };

const TAG_BLOCK = /[\u{E0000}-\u{E007F}]/gu;
const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF\u2060]/gu;
const RTL_OVERRIDE = /\u202E/gu;
const HOMOGLYPH = /[\u0400-\u04FF\u0500-\u052F]/gu;

const CATEGORIES: Array<{ regex: RegExp; name: string; severity: 'error' | 'warning' }> = [
  { regex: TAG_BLOCK, name: 'Unicode tag block', severity: 'error' },
  { regex: RTL_OVERRIDE, name: 'right-to-left override', severity: 'error' },
  { regex: ZERO_WIDTH, name: 'zero-width character', severity: 'warning' },
  { regex: HOMOGLYPH, name: 'Cyrillic homoglyph', severity: 'warning' },
];

export function noInvisibleUnicode(
  code: string,
  sourceFile?: Locator | null,
): Omit<Diagnostic, 'filePath' | 'ruleId'>[] {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  for (const category of CATEGORIES) {
    category.regex.lastIndex = 0;
    const match = category.regex.exec(code);
    if (!match) continue;
    const pos = sourceFile
      ? sourceFile.getLineAndCharacterOfPosition(match.index)
      : { line: 0, character: 0 };
    findings.push({
      severity: category.severity,
      message: `Invisible or confusable Unicode (${category.name}) found`,
      line: pos.line + 1,
      column: pos.character + 1,
    });
  }

  return findings;
}
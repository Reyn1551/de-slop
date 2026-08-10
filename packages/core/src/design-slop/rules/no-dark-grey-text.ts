import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Dark grey text on dark background — WCAG provable failure.
// 500-level muted grey on dark = 3.4-4.2:1 < 4.5:1 FAIL (error).
// 400-level = passes math (7:1) but APCA-weak (warning).
// Target comfortable: off-white #E2E8F0 (12-15:1).

const DARK_BG =
  /(?:bg-(?:slate|gray|neutral|zinc)-(?:950|900)|bg-black\b|#0(?:0[0-9a-fA-F]{3}|30|506|a0a0a0)|rgb\([0-9]+\s*[,\s]+[0-9]+\s*[,\s]+[0-9]+\)\s*[:;])/g;

const GREY_TEXT =
  /\b(?:text|text-\[\w+\])-(?:gray|slate|neutral|zinc)-(?:400|500|600|700|800|900)\b/g;

const OFF_WHITE = /text-(?:slate|gray|neutral|zinc)-(?:50|100|200|300)/g;

export const noDarkGreyText: DesignSlopRuleFn = (code, _filePath, locator) => {
  const darkBg = collectRegex(code, DARK_BG);
  if (darkBg.length === 0) return [];

  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
  for (const hit of collectRegex(code, GREY_TEXT)) {
    const shade = hit.match.match(/(\d{3})$/)?.[1] ?? '';
    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    const numeric = parseInt(shade, 10);
    if (numeric >= 500) {
      findings.push({
        severity: 'error',
        message: `Muted grey (${hit.match}) on dark background — WCAG AA contrast failure (~3.5-4.2:1 < 4.5:1); use text-slate-200/300 or #E2E8F0`,
        ...loc,
      });
    } else if (numeric === 400) {
      findings.push({
        severity: 'warning',
        message: `Grey-400 (${hit.match}) on dark — passes WCAG math but perceptually weak (APCA); prefer 300 for secondary text`,
        ...loc,
      });
    }
  }
  return findings;
};

// keep OFF_WHITE referenced for future refinement (target suggestion)
export const _offWhiteTarget = OFF_WHITE;

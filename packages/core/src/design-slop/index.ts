import type { DesignSlopOptions, Diagnostic, TextLocator } from './types';
import { rawLocator, toColumn } from './utils';
import { noAiPurple } from './rules/no-ai-purple';
import { noGradientText } from './rules/no-gradient-text';
import { noGradientButton } from './rules/no-gradient-button';
import { noGlassmorphism } from './rules/no-glassmorphism';
import { noGlowShadow } from './rules/no-glow-shadow';
import { noGradientBlob } from './rules/no-gradient-blob';
import { noDarkGreyText } from './rules/no-dark-grey-text';
import { noPureBlackBg } from './rules/no-pure-black-bg';
import { noSlopFont } from './rules/no-slop-font';

export type { Diagnostic, DesignSlopOptions } from './types';

export const DESIGN_SLOP_RULES = {
  'no-ai-purple': noAiPurple,
  'no-gradient-text': noGradientText,
  'no-gradient-button': noGradientButton,
  'no-glassmorphism': noGlassmorphism,
  'no-glow-shadow': noGlowShadow,
  'no-gradient-blob': noGradientBlob,
  'no-dark-grey-text': noDarkGreyText,
  'no-pure-black-bg': noPureBlackBg,
  'no-slop-font': noSlopFont,
} as const;

export type DesignSlopRuleId = keyof typeof DESIGN_SLOP_RULES;

export const DESIGN_SLOP_RULE_IDS = Object.keys(DESIGN_SLOP_RULES) as DesignSlopRuleId[];

// Krebs co-occurrence method: >=4 distinct design tells in one file => error.
const BUNDLE_THRESHOLD = 4;
const BUNDLE_RULE_ID = 'design-slop-bundle';

// Static markers that supplement the 9 main rules for bundle detection only —
// never reported standalone (single marker = legit, e.g. Apple has FAQ + numbers).
const BUNDLE_MARKERS = [
  /FAQ|Frequently asked questions/i,
  /How it works/i,
  /Trusted by/i,
  /[0-9]+\+?\s*(?:users|developers|teams|companies|stars)/i,
  /4\.9\s*★|99\.9%\s*uptime/i,
  /grid-cols-(?:2|3)\b/,
];

export function scanDesignSlop(
  code: string,
  filePath: string,
  options: DesignSlopOptions = {},
): Diagnostic[] {
  // Design-slop rules read className strings / CSS — test fixtures often contain
  // slop on purpose as test data, and this module's own rule sources hold slop
  // pattern literals as regex detectors. Skip them (same policy as agent-guard).
  if (
    /\/design-slop\/(?:rules|fixtures?)\//.test(filePath) ||
    /\/(?:test|tests|__tests__|fixtures?|e2e)\//.test(filePath) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(filePath)
  ) {
    return [];
  }

  const locator = rawLocator(code);
  const diagnostics: Diagnostic[] = [];

  const enabled = options.rules
    ? options.rules.filter((r): r is DesignSlopRuleId => r in DESIGN_SLOP_RULES)
    : DESIGN_SLOP_RULE_IDS;

  for (const ruleId of enabled) {
    const findings = DESIGN_SLOP_RULES[ruleId](code, filePath, locator);
    for (const finding of findings) {
      diagnostics.push({ ...finding, ruleId, filePath });
    }
  }

  const triggered = new Set(diagnostics.map((d) => d.ruleId));
  if (triggered.size >= BUNDLE_THRESHOLD) {
    const markerHits = BUNDLE_MARKERS.filter((m) => m.test(code)).length;
    const loc = toColumn(locator.getLineAndCharacterOfPosition(0));
    diagnostics.push({
      ruleId: BUNDLE_RULE_ID,
      severity: 'error',
      message: `${triggered.size} AI design tells in this file${markerHits > 0 ? ` + ${markerHits} section-skeleton markers` : ''} — statistically likely AI-generated design (Krebs co-occurrence method, 22% of Show HN sites hit this); audit copy, color, and typography`,
      filePath,
      ...loc,
    });
  }

  return diagnostics;
}

export function designSlopScan(
  code: string,
  filePath: string,
  options?: DesignSlopOptions,
): Diagnostic[] {
  return scanDesignSlop(code, filePath, options);
}

export { rawLocator, toColumn };
export type { TextLocator };

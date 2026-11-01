import type { Diagnostic, UxGuardOptions } from './types';
import { rawLocator, toColumn } from './utils';
import { noImgMissingAlt } from './rules/no-img-missing-alt';
import { noIconButtonUnlabeled } from './rules/no-icon-button-unlabeled';
import { noFocusRemoved } from './rules/no-focus-removed';
import { noPlaceholderLabel } from './rules/no-placeholder-label';
import { noZoomBlock } from './rules/no-zoom-block';
import { noTouchTargetSmall } from './rules/no-touch-target-small';
import { noAnimationWithoutReducedMotion } from './rules/no-animation-without-reduced-motion';
import { noLayoutAnimation } from './rules/no-layout-animation';
import { noOffGridSpacing } from './rules/no-off-grid-spacing';
import { noTinyText } from './rules/no-tiny-text';
import { noZIndexChaos } from './rules/no-z-index-chaos';
import { noHoverOnly } from './rules/no-hover-only';

export type { Diagnostic, TextLocator, UxFinding, UxGuardOptions, UxRuleFn } from './types';

export const UX_RULES = {
  'no-img-missing-alt': noImgMissingAlt,
  'no-icon-button-unlabeled': noIconButtonUnlabeled,
  'no-focus-removed': noFocusRemoved,
  'no-placeholder-label': noPlaceholderLabel,
  'no-zoom-block': noZoomBlock,
  'no-touch-target-small': noTouchTargetSmall,
  'no-animation-without-reduced-motion': noAnimationWithoutReducedMotion,
  'no-layout-animation': noLayoutAnimation,
  'no-off-grid-spacing': noOffGridSpacing,
  'no-tiny-text': noTinyText,
  'no-z-index-chaos': noZIndexChaos,
  'no-hover-only': noHoverOnly,
} as const;

export type UxRuleId = keyof typeof UX_RULES;

export const UX_RULE_IDS = Object.keys(UX_RULES) as UxRuleId[];

export function scanUx(code: string, filePath: string, options: UxGuardOptions = {}): Diagnostic[] {
  // UX rules read className strings and markup — test fixtures contain broken
  // a11y on purpose and this module's own rule sources hold pattern literals.
  if (
    /\/ux-guard\/(?:rules|fixtures?)\//.test(filePath) ||
    /\/(?:test|tests|__tests__|fixtures?|e2e)\//.test(filePath) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(filePath)
  ) {
    return [];
  }

  const locator = rawLocator(code);
  const diagnostics: Diagnostic[] = [];

  const enabled = options.rules
    ? options.rules.filter((r): r is UxRuleId => r in UX_RULES)
    : UX_RULE_IDS;

  for (const ruleId of enabled) {
    for (const finding of UX_RULES[ruleId](code, filePath, locator)) {
      diagnostics.push({ ...finding, ruleId, filePath });
    }
  }

  return diagnostics;
}

export { rawLocator, toColumn };

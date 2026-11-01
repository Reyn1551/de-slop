import type { UxFinding, UxRuleFn } from '../types';
import { collectRegex, finding } from '../utils';

const ANIMATION = /(?:^|[\s"'`:])animate-|(?:^|[\s"'`:])transition-|@keyframes\b/;
const REDUCED_MOTION = /motion-reduce:|prefers-reduced-motion/;

export const noAnimationWithoutReducedMotion: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  const first = collectRegex(code, ANIMATION)[0];
  if (!first || REDUCED_MOTION.test(code)) return findings;

  findings.push(
    finding(
      locator,
      first.index,
      'warning',
      'Motion without a reduced-motion guard — add motion-reduce:transition-none / motion-reduce:animate-none or a prefers-reduced-motion media query; animation can trigger nausea and vertigo (WCAG 2.3.3)',
    ),
  );
  return findings;
};

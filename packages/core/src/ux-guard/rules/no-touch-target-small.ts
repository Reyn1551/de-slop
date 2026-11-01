import type { UxFinding, UxRuleFn } from '../types';
import { classNameOf, collectTags, finding, resolveSpacing } from '../utils';

const MIN_TARGET_PX = 44;

function dimension(token: string, axis: 'h' | 'w'): number | null {
  const base = token.split(':').pop() ?? token;
  if (!base.startsWith(`${axis}-`)) return null;
  return resolveSpacing(base.slice(2));
}

export const noTouchTargetSmall: UxRuleFn = (code, _filePath, locator) => {
  const findings: UxFinding[] = [];
  for (const { tag, index, name } of collectTags(code)) {
    if (name !== 'button' && name !== 'a') continue;
    const className = classNameOf(tag);
    if (!className) continue;

    const tokens = className.split(/\s+/);
    let height: number | null = null;
    let width: number | null = null;
    let hasHeight = false;
    let hasWidth = false;
    for (const token of tokens) {
      const base = token.split(':').pop() ?? token;
      if (base.startsWith('h-')) {
        hasHeight = true;
        height ??= dimension(token, 'h');
      }
      if (base.startsWith('w-')) {
        hasWidth = true;
        width ??= dimension(token, 'w');
      }
    }
    if (!hasHeight && !hasWidth) continue;

    const heightSmall = height !== null && height < MIN_TARGET_PX;
    const widthSmall = width !== null && width < MIN_TARGET_PX;
    const bothSmall = heightSmall && widthSmall;
    const oneSmallOtherAbsent =
      (heightSmall && !hasWidth) || (widthSmall && !hasHeight);
    if (!bothSmall && !oneSmallOtherAbsent) continue;

    const dims = [height !== null ? `h=${height}px` : null, width !== null ? `w=${width}px` : null]
      .filter((d): d is string => d !== null)
      .join(', ');
    findings.push(
      finding(
        locator,
        index,
        'warning',
        `Touch target below 44x44px (${dims}) — too small for reliable thumb input; use min-h-11 / min-w-11 or add padding (WCAG 2.5.8)`,
      ),
    );
  }
  return findings;
};

import type { TextLocator, UxFinding } from './types';

export { rawLocator, toColumn, collectRegex, countRegex } from '../design-slop/utils';

export const CSS_UNIT_SCALE: Record<string, number> = {
  '0': 0,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '3.5': 14,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '11': 44,
  '12': 48,
  '14': 56,
  '16': 64,
  '20': 80,
  '24': 96,
};

/** Resolve a Tailwind spacing token (`8`, `2.5`, `[44px]`) to CSS pixels. */
export function resolveSpacing(token: string): number | null {
  const arbitrary = /^\[(\d+(?:\.\d+)?)px\]$/.exec(token);
  if (arbitrary) return Number(arbitrary[1]);
  const value = CSS_UNIT_SCALE[token];
  return value === undefined ? null : value;
}

export function classNameOf(tag: string): string | null {
  const match = /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{(["'])(.*?)\4\})/.exec(tag);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? match[5] ?? null;
}

/** Every opening JSX tag with its source offset. */
export function collectTags(code: string): { tag: string; index: number; name: string }[] {
  const tags: { tag: string; index: number; name: string }[] = [];
  const pattern = /<([A-Za-z][\w.]*)\b(?:[^<>"']|"[^"]*"|'[^']*'|\{[^{}]*\})*?\/?>/g;
  for (const match of code.matchAll(pattern)) {
    tags.push({ tag: match[0], index: match.index ?? 0, name: match[1] });
  }
  return tags;
}

/** Body text of an element, found by scanning forward to its matching close tag. */
export function elementBody(code: string, tagIndex: number, name: string): string {
  const openEnd = code.indexOf('>', tagIndex);
  if (openEnd === -1) return '';
  const closePattern = new RegExp(`</${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*>`);
  const rest = code.slice(openEnd + 1);
  const close = closePattern.exec(rest);
  const selfClosing = code[openEnd - 1] === '/';
  if (selfClosing) return '';
  return close ? rest.slice(0, close.index) : rest.slice(0, 400);
}

export function finding(
  locator: TextLocator,
  index: number,
  severity: 'error' | 'warning',
  message: string,
): UxFinding {
  const position = locator.getLineAndCharacterOfPosition(index);
  return { severity, message, line: position.line + 1, column: position.character + 1 };
}

export function isCssFile(filePath: string): boolean {
  return /\.(?:css|scss|sass|less)$/i.test(filePath);
}

export function isMarkupFile(filePath: string): boolean {
  return /\.(?:tsx|jsx|html?|vue|svelte|astro|mdx)$/i.test(filePath);
}

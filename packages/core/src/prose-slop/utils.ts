import type { ProseContext, ProseFinding } from './types';
import { toColumn } from './mask';

export function report(
  context: ProseContext,
  index: number,
  severity: 'error' | 'warning',
  message: string,
): ProseFinding {
  return { severity, message, ...toColumn(context.locator.getLineAndCharacterOfPosition(index)) };
}

export function countMatches(text: string, pattern: RegExp): number {
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  return [...text.matchAll(global)].length;
}

import type { ContextRotFinding, TextLocator } from '../types';

export function report(
  context: { content: string; locator: TextLocator },
  index: number,
  severity: 'error' | 'warning',
  message: string,
): ContextRotFinding {
  const position = context.locator.getLineAndCharacterOfPosition(index);
  return { severity, message, line: position.line + 1, column: position.character + 1 };
}

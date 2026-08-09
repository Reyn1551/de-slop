import type { Diagnostic } from './types';

export function applyFixes(code: string, diagnostics: Diagnostic[]): string {
  const fixes = diagnostics
    .filter((diagnostic) => diagnostic.fix !== undefined)
    .map((diagnostic) => diagnostic.fix!)
    .sort((a, b) => b.start - a.start);
  let result = code;
  for (const fix of fixes) {
    result = result.slice(0, fix.start) + fix.replacement + result.slice(fix.end);
  }
  return result;
}

import { parseSourceFile } from '../slop-scanner/scanner';
import type { Diagnostic } from '../slop-scanner/types';
import { runtimeRules } from './rules';

export { runtimeRules } from './rules';
export type { Diagnostic } from '../slop-scanner/types';

export function guardSource(code: string, filePath: string, options: { rules?: string[] } = {}): Diagnostic[] {
  const sourceFile = parseSourceFile(code, filePath);
  const active = options.rules ? runtimeRules.filter((rule) => options.rules!.includes(rule.id)) : runtimeRules;
  const diagnostics: Diagnostic[] = [];
  for (const rule of active) {
    for (const finding of rule.check(sourceFile)) {
      diagnostics.push({ ...finding, ruleId: rule.id, filePath });
    }
  }
  return diagnostics;
}

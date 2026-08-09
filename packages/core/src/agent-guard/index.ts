import { parseSourceFile } from '../slop-scanner/scanner';
import type { Diagnostic } from './types';
import { agentGuardRules } from './rules';
import { noInvisibleUnicode } from './rules/no-invisible-unicode';
import { noUnsafeInstallDocs } from './rules/no-unsafe-install-docs';

export { agentGuardRules } from './rules';
export type { AgentGuardResult, Diagnostic } from './types';
export { noInvisibleUnicode } from './rules/no-invisible-unicode';
export { noUnsafeInstallDocs } from './rules/no-unsafe-install-docs';

export interface AgentGuardOptions {
  rules?: string[];
}

const TEXT_RULES = new Set(['no-invisible-unicode', 'no-unsafe-install-docs']);

const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs|json)$/;

function rawLocator(code: string) {
  const lines = code.split('\n');
  return {
    getLineAndCharacterOfPosition(pos: number) {
      let line = 0;
      while (line < lines.length - 1 && pos >= lines[line].length + 1) {
        pos -= lines[line].length + 1;
        line++;
      }
      return { line, character: Math.max(0, pos) };
    },
  };
}

function toColumn(loc: { line: number; character: number }): { line: number; column: number } {
  return { line: loc.line + 1, column: loc.character + 1 };
}

export function agentGuardScan(
  code: string,
  filePath: string,
  options: AgentGuardOptions = {},
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const isCode = CODE_EXTENSIONS.test(filePath);
  const isDoc = /\.(md|mdx|txt|rst|adoc|markdown)$/i.test(filePath);

  let sourceFile: ReturnType<typeof parseSourceFile> | null = null;
  if (isCode) {
    sourceFile = parseSourceFile(code, filePath);
    const active = options.rules
      ? agentGuardRules.filter((r) => options.rules!.includes(r.id))
      : agentGuardRules;
    for (const rule of active) {
      for (const finding of rule.check(sourceFile, { filePath, fileExists: () => true })) {
        diagnostics.push({ ...finding, ruleId: rule.id, filePath });
      }
    }
  }

  const textRules = options.rules
    ? options.rules.filter((id) => TEXT_RULES.has(id))
    : [...TEXT_RULES];

  const locator = sourceFile ?? rawLocator(code);

  if (textRules.includes('no-unsafe-install-docs') && isDoc) {
    for (const finding of noUnsafeInstallDocs(code, filePath, locator)) {
      diagnostics.push({ ...finding, ruleId: 'no-unsafe-install-docs', filePath });
    }
  }

  if (textRules.includes('no-invisible-unicode')) {
    for (const finding of noInvisibleUnicode(code, locator)) {
      diagnostics.push({ ...finding, ruleId: 'no-invisible-unicode', filePath });
    }
  }

  return diagnostics;
}
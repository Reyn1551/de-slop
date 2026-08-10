import { ast, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

const PILL_CLASS_PATTERNS = [
  /hero-pill/i,
  /preset-badge/i,
  /\b(hero|status|feature|new|beta|pill|badge)([-_])?pill\b/i,
  /\b(badge|pill)[-_\s]*(badge|pill)\b/i,
];

const HERO_EMOJI_WORDS = /\p{Extended_Pictographic}/u;

export const noHeroPill: Rule = {
  id: 'no-hero-pill',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const text = sourceFile.text;

    function visit(node: any): void {
      if (ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node)) {
        const value = node.text;
        if (PILL_CLASS_PATTERNS.some((p) => p.test(value))) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            severity: 'warning',
            message: 'Pill/badge class pattern detected — classic AI slop landing page tell. Remove the colored pill badge.',
            line: pos.line + 1,
            column: pos.character + 1,
          });
        }
      }

      if (ast.isTemplateExpression(node)) {
        const full = node.head?.text ?? '';
        if (PILL_CLASS_PATTERNS.some((p) => p.test(full))) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            severity: 'warning',
            message: 'Pill/badge class pattern detected — classic AI slop landing page tell.',
            line: pos.line + 1,
            column: pos.character + 1,
          });
        }
      }

      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};
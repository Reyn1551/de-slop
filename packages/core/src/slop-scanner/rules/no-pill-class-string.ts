import { ast, type Node } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

// A class string that literally names a hero pill. The structural detector
// lives in design-slop (`no-hero-pill`), which checks a pill element's position
// relative to the heading. This rule only catches the leftover template
// vocabulary an agent writes when it copies a landing-page snippet, so it looks
// for explicit pill naming and never for the bare word "pill" near an adjective
// (a pharmacy app's "new pill inventory" is not slop).

const PILL_CLASS_PATTERNS = [
  /hero-pill/i,
  /hero\s+pill/i,
  /\bpill-(?:badge|cta|hero)\b/i,
  /\b(?:badge|cta)-pill\b/i,
];

export const noPillClassString: Rule = {
  id: 'no-pill-class-string',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

    function report(node: Node): void {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      findings.push({
        severity: 'warning',
        message: 'Pill/badge class name in a string — classic AI landing-page tell; remove the pill or replace it with a real product signal',
        line: position.line + 1,
        column: position.character + 1,
      });
    }

    function visit(node: Node): void {
      // Module specifiers name files, not class strings.
      if (ast.isImportDeclaration(node) || ast.isExportDeclaration(node) || ast.isImportEqualsDeclaration(node)) {
        return;
      }

      if (ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node)) {
        if (PILL_CLASS_PATTERNS.some((pattern) => pattern.test(node.text))) report(node);
      }

      if (ast.isTemplateExpression(node)) {
        const head = node.head?.text ?? '';
        if (PILL_CLASS_PATTERNS.some((pattern) => pattern.test(head))) report(node);
      }

      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};

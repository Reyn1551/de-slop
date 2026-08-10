import { ast, type SourceFile, type Node } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

function hasSanitizerInScope(node: Node, sourceFile: SourceFile): boolean {
  const text = sourceFile.text;
  const fileText = text.slice(0, node.getEnd());
  const importPattern = /import\s+(?:[\w*\s{},]*\s+from\s+)?['"]((?:dompurify|sanitize-html|xss|bleach)[^'"]*)['"]/i;
  const requirePattern = /(?:require|import)\s*\(\s*['"](dompurify|sanitize-html|xss)['"]\s*\)/i;
  const sanitizeCall = /\b(DOMPurify\.sanitize|sanitizeHtml|sanitize|escapeHtml|xss)\s*\(/i;
  return importPattern.test(fileText) || requirePattern.test(fileText) || sanitizeCall.test(fileText);
}

export const noUnsafeInnerHtml: Rule = {
  id: 'no-unsafe-innerhtml',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const text = sourceFile.text;

    function visit(node: any): void {
      if (ast.isPropertyAccessExpression(node)) {
        const name = node.name?.text;
        if (name === 'innerHTML' || name === 'outerHTML') {
          const parent = node.parent;
          if (parent && ast.isBinaryExpression(parent) && parent.operatorToken?.kind === ast.SyntaxKind.EqualsToken) {
            if (!hasSanitizerInScope(node, sourceFile)) {
              const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              findings.push({
                severity: 'error',
                message: `Unsanitized ${name} assignment — XSS vulnerability. Use DOMPurify.sanitize() or similar.`,
                line: pos.line + 1,
                column: pos.character + 1,
              });
            }
          }
        }
      }

      if (ast.isJsxAttribute && ast.isJsxAttribute(node)) {
        const attrName = (node.name as any)?.text;
        if (attrName === 'dangerouslySetInnerHTML') {
          if (!hasSanitizerInScope(node, sourceFile)) {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              severity: 'error',
              message: 'Unsanitized dangerouslySetInnerHTML — XSS vulnerability. Use DOMPurify.sanitize() or similar.',
              line: pos.line + 1,
              column: pos.character + 1,
            });
          }
        }
      }

      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};
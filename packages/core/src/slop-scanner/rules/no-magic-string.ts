import { ast, type Node, type SourceFile, type StringLiteral } from '../ts-api';
import type { Diagnostic, Rule, RuleContext } from '../types';

const URL_PATTERN = /^(https?|ftp):\/\//i;
const NUMBER_PATTERN = /^\d{4,}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;
const ERROR_LIKE_PATTERN = /[\s.,;:!?()[\]{}]/;
const CONFIG_FILE_PATTERN = /(config|constant)/i;

function inSkippedContext(node: StringLiteral): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ast.isImportDeclaration(parent) || ast.isExportDeclaration(parent)) return true;
  if (ast.isJsxAttribute(parent)) return true;
  if (ast.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  if (ast.isCallExpression(parent)) {
    const expression = parent.expression;
    if (ast.isIdentifier(expression) && expression.text === 'require') return true;
  }
  return false;
}

function inConfigFile(context?: RuleContext): boolean {
  return !!context && CONFIG_FILE_PATTERN.test(context.filePath);
}

export const noMagicString: Rule = {
  id: 'no-magic-string',
  check(sourceFile, context) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

    function visit(node: Node): void {
      if (ast.isStringLiteral(node)) {
        const value = node.text;
        if (!inSkippedContext(node)) {
          let kind: string | undefined;
          if (URL_PATTERN.test(value) && !inConfigFile(context)) {
            kind = 'URL';
          } else if (EMAIL_PATTERN.test(value)) {
            kind = 'email address';
          } else if (DOMAIN_PATTERN.test(value)) {
            kind = 'domain name';
          } else if (NUMBER_PATTERN.test(value)) {
            kind = 'numeric magic value';
          } else if (value.length < 4 || ERROR_LIKE_PATTERN.test(value)) {
            kind = undefined;
          }
          if (kind) {
            const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              severity: 'warning',
              message: `Hardcoded ${kind} string "${value}" looks like a magic value`,
              line: position.line + 1,
              column: position.character + 1,
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

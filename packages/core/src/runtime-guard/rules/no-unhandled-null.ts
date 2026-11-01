import { ast, type Node, type SourceFile } from '../../slop-scanner/ts-api';
import type { Diagnostic, Rule } from '../../slop-scanner/types';

// Exact names only. A substring match turned `findSourceFiles(...).files` into
// an unguarded null access because the helper name contains "find".
const NULLABLE_METHODS: Record<string, true> = {
  find: true,
  findLast: true,
  pop: true,
  shift: true,
  querySelector: true,
  getElementById: true,
};

function nullableCallExpression(node: Node): boolean {
  if (!ast.isCallExpression(node)) return false;
  const callee = node.expression;
  if (ast.isPropertyAccessExpression(callee)) {
    return NULLABLE_METHODS[callee.name.text] === true;
  }
  if (ast.isIdentifier(callee)) {
    return NULLABLE_METHODS[callee.text] === true;
  }
  return false;
}

export const noUnhandledNull: Rule = {
  id: 'no-unhandled-null',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

    function isUnsafeChain(node: Node): boolean {
      if (!ast.isPropertyAccessExpression(node)) return false;
      if (node.questionDotToken) return false;
      const expr = node.expression;
      if (ast.isCallExpression(expr) && nullableCallExpression(expr)) {
        return true;
      }
      return isUnsafeChain(expr);
    }

    function visit(node: Node): void {
      if (ast.isPropertyAccessExpression(node) && isUnsafeChain(node)) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        findings.push({
          severity: 'warning',
          message: 'Accessing a property on a possibly-null result of find/getElementById without a guard',
          line: position.line + 1,
          column: position.character + 1,
        });
      }
      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};

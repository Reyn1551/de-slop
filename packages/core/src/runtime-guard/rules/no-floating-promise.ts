import { ast, type Node, type SourceFile } from '../../slop-scanner/ts-api';
import type { Diagnostic, Rule } from '../../slop-scanner/types';

const PROMISEY_NAMES = /fetch|load|save|send|request|query|exec|run|init/i;

function collectAsyncNames(sourceFile: SourceFile): Set<string> {
  const names = new Set<string>();
  function visit(node: Node): void {
    if (ast.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ast.SyntaxKind.AsyncKeyword) && node.name && ast.isIdentifier(node.name)) {
      names.add(node.name.text);
    }
    if (ast.isArrowFunction(node) && node.modifiers?.some((m) => m.kind === ast.SyntaxKind.AsyncKeyword)) {
      const parent = node.parent;
      if (ast.isVariableDeclaration(parent) && ast.isIdentifier(parent.name)) {
        names.add(parent.name.text);
      }
    }
    node.forEachChild(visit);
  }
  visit(sourceFile);
  return names;
}

function isPromiseyCall(call: Node, asyncNames: Set<string>): boolean {
  const callee = (call as any).expression as Node;
  if (ast.isIdentifier(callee)) {
    return asyncNames.has(callee.text) || PROMISEY_NAMES.test(callee.text);
  }
  if (ast.isPropertyAccessExpression(callee)) {
    return PROMISEY_NAMES.test(callee.name.text);
  }
  return false;
}

function isHandled(node: Node): boolean {
  let current = node.parent;
  while (current) {
    if (ast.isExpressionStatement(current)) return false;
    if (ast.isAwaitExpression(current) || ast.isReturnStatement(current) || ast.isVariableDeclaration(current)) return true;
    if (ast.isPropertyAccessExpression(current)) {
      const text = current.name.text;
      if (text === 'then' || text === 'catch' || text === 'finally') return true;
    }
    if (ast.isCallExpression(current) && ast.isPrefixUnaryExpression(current.parent) && current.parent.getText().startsWith('void')) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

export const noFloatingPromise: Rule = {
  id: 'no-floating-promise',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const asyncNames = collectAsyncNames(sourceFile);

    function visit(node: Node): void {
      if (ast.isExpressionStatement(node)) {
        const expr = node.expression;
        if (ast.isCallExpression(expr) && isPromiseyCall(expr, asyncNames) && !isHandled(expr)) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            severity: 'warning',
            message: 'Async call is not awaited, returned, or caught — unhandled promise',
            line: position.line + 1,
            column: position.character + 1,
          });
        }
      }
      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};

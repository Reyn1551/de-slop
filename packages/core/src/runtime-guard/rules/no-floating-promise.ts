import { ast, type Node } from '../../slop-scanner/ts-api';
import type { Diagnostic, Rule } from '../../slop-scanner/types';

// A promise created and dropped. The detection is name-based, so it only looks
// at calls whose callee is an async function declared in the file, or a known
// async API. A synchronous helper named `run` or `load` is not a promise, and
// guessing from the name produced false positives on `spawnSync` wrappers.

const ASYNC_APIS: Record<string, true> = {
  fetch: true,
  readFile: true,
  writeFile: true,
  mkdir: true,
  rm: true,
  copyFile: true,
  stat: true,
  readdir: true,
  access: true,
};

function collectAsyncNames(sourceFile: { forEachChild?: unknown } & Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: Node): void => {
    if (ast.isFunctionDeclaration(node) && node.name && ast.isIdentifier(node.name)) {
      if (node.modifiers?.some((modifier) => modifier.kind === ast.SyntaxKind.AsyncKeyword)) {
        names.add(node.name.text);
      }
    }
    if (ast.isVariableDeclaration(node) && ast.isIdentifier(node.name)) {
      const initializer = node.initializer;
      if (initializer && ast.isArrowFunction(initializer) && initializer.modifiers?.some((modifier) => modifier.kind === ast.SyntaxKind.AsyncKeyword)) {
        names.add(node.name.text);
      }
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return names;
}

function isPromiseCall(call: Node, asyncNames: Set<string>): boolean {
  const callee = (call as { expression?: Node }).expression;
  if (!callee) return false;
  if (ast.isIdentifier(callee)) {
    return asyncNames.has(callee.text) || ASYNC_APIS[callee.text] === true;
  }
  if (ast.isPropertyAccessExpression(callee)) {
    return ASYNC_APIS[callee.name.text] === true;
  }
  return false;
}

function isHandled(node: Node): boolean {
  let current: Node | undefined = node.parent;
  while (current) {
    if (ast.isExpressionStatement(current)) return false;
    if (ast.isAwaitExpression(current) || ast.isReturnStatement(current) || ast.isVariableDeclaration(current)) return true;
    if (ast.isPropertyAccessExpression(current)) {
      const name = current.name.text;
      if (name === 'then' || name === 'catch' || name === 'finally') return true;
    }
    if (ast.isPrefixUnaryExpression(current) && current.getText().startsWith('void')) return true;
    current = current.parent;
  }
  return false;
}

export const noFloatingPromise: Rule = {
  id: 'no-floating-promise',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const asyncNames = collectAsyncNames(sourceFile as unknown as Node);

    const visit = (node: Node): void => {
      if (ast.isExpressionStatement(node) && ast.isCallExpression(node.expression)) {
        if (isPromiseCall(node.expression, asyncNames) && !isHandled(node.expression)) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            severity: 'warning',
            message: 'Async call is not awaited, returned, or caught — the rejection escapes as an unhandled promise',
            line: position.line + 1,
            column: position.character + 1,
          });
        }
      }
      node.forEachChild(visit);
    };

    visit(sourceFile as unknown as Node);
    return findings;
  },
};

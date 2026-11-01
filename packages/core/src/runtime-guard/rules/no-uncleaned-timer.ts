import { ast, type Node, type SourceFile } from '../../slop-scanner/ts-api';
import type { Diagnostic, Rule } from '../../slop-scanner/types';

// A timer created and never cleared. `require-cleanup` handles timers assigned
// to a name and paired with a clear call; this rule covers the bare call, which
// has no handle to clear at all.
//
// Scope matters. The earlier version asked whether the word "useEffect" or
// "cleanup" appeared anywhere before the call, so one effect at the top of a
// file silenced every timer below it. Now the check is the enclosing function
// or the enclosing effect callback: a timer inside an effect that returns a
// cleanup is fine, and a timer in a plain function is not.

const TIMER_FUNCTIONS: Record<string, true> = { setTimeout: true, setInterval: true };
const CLEAR_FUNCTIONS: Record<string, true> = { clearTimeout: true, clearInterval: true };

function calleeName(node: Node): string | null {
  if (!ast.isCallExpression(node)) return null;
  const callee = node.expression;
  return ast.isIdentifier(callee) ? callee.text : null;
}

function isFunctionNode(node: Node): boolean {
  return (
    ast.isArrowFunction(node) ||
    ast.isFunctionDeclaration(node) ||
    ast.isFunctionExpression(node) ||
    ast.isMethodDeclaration(node)
  );
}

/** The nearest enclosing function or effect callback, or the file itself. */
function enclosingScope(node: Node, sourceFile: SourceFile): Node {
  let current = node.parent;
  while (current) {
    if (isFunctionNode(current) || ast.isSourceFile(current)) return current;
    current = current.parent;
  }
  return sourceFile;
}

function scopeContainsClear(scope: Node): boolean {
  let found = false;
  const visit = (node: Node): void => {
    if (found) return;
    const name = calleeName(node);
    if (name !== null && CLEAR_FUNCTIONS[name]) {
      found = true;
      return;
    }
    node.forEachChild(visit);
  };
  visit(scope);
  return found;
}

// require-cleanup reports a timer that is assigned and never cleared. This rule
// covers the other half: a timer with no handle at all, where nothing in the
// file could ever clear it.
function isAssigned(node: Node): boolean {
  let current = node.parent;
  let depth = 0;
  while (current && depth < 3) {
    if (ast.isVariableDeclaration(current)) return true;
    if (ast.isPropertyAssignment(current) || ast.isBinaryExpression(current)) return true;
    current = current.parent;
    depth += 1;
  }
  return false;
}

export const noUncleanedTimer: Rule = {
  id: 'no-uncleaned-timer',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

    const visit = (node: Node): void => {
      const name = calleeName(node);
      if (name !== null && TIMER_FUNCTIONS[name] && !isAssigned(node)) {
        const scope = enclosingScope(node, sourceFile);
        if (!scopeContainsClear(scope)) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            severity: 'warning',
            message: `${name}() has no handle and no clear${name.replace('setTimeout', 'Timeout').replace('setInterval', 'Interval')}() in this scope — the callback can fire after the component is gone; assign the id and clear it in cleanup`,
            line: position.line + 1,
            column: position.character + 1,
          });
        }
      }
      node.forEachChild(visit);
    };

    visit(sourceFile);
    return findings;
  },
};

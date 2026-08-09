import { ast, type Node, type SourceFile } from '../../slop-scanner/ts-api';
import type { Diagnostic, Rule } from '../../slop-scanner/types';

interface Open {
  kind: 'listener' | 'interval' | 'timeout';
  key: string;
  node: Node;
}

function argString(node: Node | undefined, depth = 0): string {
  if (!node) return '';
  if (depth > 6) return '';
  if (ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ast.isIdentifier(node)) return node.text;
  if (ast.isPropertyAccessExpression(node)) return `${argString(node.expression, depth + 1)}.${node.name.text}`;
  return '';
}

function collectOpensCloses(body: Node): { opens: Open[]; closes: string[] } {
  const opens: Open[] = [];
  const closes: string[] = [];

  function visit(node: Node): void {
    if (ast.isCallExpression(node)) {
      const calleeName = node.expression.getText();
      if (calleeName.includes('addEventListener') && node.arguments.length >= 2) {
        const target = argString(node.arguments[0]);
        const event = argString(node.arguments[1]);
        opens.push({ kind: 'listener', key: `listener:${target}:${event}`, node });
      } else if (calleeName.includes('removeEventListener') && node.arguments.length >= 2) {
        const target = argString(node.arguments[0]);
        const event = argString(node.arguments[1]);
        closes.push(`listener:${target}:${event}`);
      } else if (calleeName.includes('setInterval')) {
        const id = findAssignedId(node);
        opens.push({ kind: 'interval', key: `interval:${id}`, node });
      } else if (calleeName.includes('clearInterval') && node.arguments[0] && ast.isIdentifier(node.arguments[0])) {
        closes.push(`interval:${(node.arguments[0] as any).text}`);
      } else if (calleeName.includes('setTimeout')) {
        const id = findAssignedId(node);
        if (id) opens.push({ kind: 'timeout', key: `timeout:${id}`, node });
      } else if (calleeName.includes('clearTimeout') && node.arguments[0] && ast.isIdentifier(node.arguments[0])) {
        closes.push(`timeout:${(node.arguments[0] as any).text}`);
      }
    }
    node.forEachChild(visit);
  }

  visit(body);
  return { opens, closes };
}

function findAssignedId(call: Node): string {
  let current = call.parent;
  let depth = 0;
  while (current && depth < 4) {
    if (ast.isVariableDeclaration(current) && current.name && ast.isIdentifier(current.name)) {
      return current.name.text;
    }
    if (ast.isPropertyAccessExpression(current)) {
      current = current.parent;
      depth++;
      continue;
    }
    break;
  }
  return '';
}

function isInsideUseEffect(node: Node): boolean {
  let current = node.parent;
  while (current) {
    if (ast.isCallExpression(current)) {
      const callee = current.expression;
      if (ast.isIdentifier(callee) && callee.text === 'useEffect') return true;
      if (ast.isPropertyAccessExpression(callee) && callee.name.text === 'useEffect') return true;
    }
    if (ast.isFunctionDeclaration(current) || ast.isMethodDeclaration(current)) return false;
    current = current.parent;
  }
  return false;
}

function isFunctionNode(node: Node): boolean {
  return ast.isArrowFunction(node) || ast.isFunctionDeclaration(node) || ast.isFunctionExpression(node);
}

function scanScope(sourceFile: SourceFile, scopeNode: Node): Omit<Diagnostic, 'filePath' | 'ruleId'>[] {
  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
  const { opens, closes } = collectOpensCloses(scopeNode);
  const closeSet = new Set(closes);
  for (const open of opens) {
    if (closeSet.has(open.key)) continue;
    const position = sourceFile.getLineAndCharacterOfPosition(open.node.getStart());
    const inEffect = isInsideUseEffect(open.node);
    const hint = inEffect
      ? 'Add a cleanup return in the useEffect callback'
      : `Pair the ${open.kind} with a matching cleanup call`;
    findings.push({
      severity: 'warning',
      message: `${hint} (unmatched ${open.kind}: ${open.key})`,
      line: position.line + 1,
      column: position.character + 1,
    });
  }
  return findings;
}

export const requireCleanup: Rule = {
  id: 'require-cleanup',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    findings.push(...scanScope(sourceFile, sourceFile));

    function visit(node: Node): void {
      if (isFunctionNode(node)) {
        const body = (node as any).body as Node | undefined;
        if (body && (ast.isBlock(body) || ast.isExpression(body))) {
          findings.push(...scanScope(sourceFile, body));
        }
      }
      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};

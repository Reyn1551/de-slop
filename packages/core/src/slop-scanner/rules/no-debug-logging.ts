import { ast, type CallExpression, type Node, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule, RuleContext } from '../types';

const DEBUG_METHODS = new Set(['log', 'warn', 'info']);
const MIN_OCCURRENCES = 3;

function isTestFile(context?: RuleContext): boolean {
  if (!context) return false;
  const fileName = context.filePath.split('/').pop() ?? '';
  return /\.(test|spec)\./.test(fileName);
}

function consoleMethodName(node: CallExpression): string | undefined {
  const expression = node.expression;
  if (!ast.isPropertyAccessExpression(expression)) return undefined;
  if (!ast.isIdentifier(expression.expression) || expression.expression.text !== 'console') return undefined;
  if (!ast.isIdentifier(expression.name)) return undefined;
  return DEBUG_METHODS.has(expression.name.text) ? expression.name.text : undefined;
}

function collectConsoleCalls(sourceFile: SourceFile): CallExpression[] {
  const calls: CallExpression[] = [];
  function visit(node: Node): void {
    if (ast.isCallExpression(node) && consoleMethodName(node)) calls.push(node);
    node.forEachChild(visit);
  }
  visit(sourceFile);
  return calls;
}

export const noDebugLogging: Rule = {
  id: 'no-debug-logging',
  check(sourceFile, context) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    if (isTestFile(context)) return findings;

    const calls = collectConsoleCalls(sourceFile);
    if (calls.length < MIN_OCCURRENCES) return findings;

    for (const call of calls) {
      const position = sourceFile.getLineAndCharacterOfPosition(call.getStart());
      findings.push({
        severity: 'warning',
        message: `Debug logging residue: ${calls.length} console.${consoleMethodName(call)} calls in this file`,
        line: position.line + 1,
        column: position.character + 1,
      });
    }
    return findings;
  },
};

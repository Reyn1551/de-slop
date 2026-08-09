import { ast, type Node, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

const MAX_FUNCTION_BODY_LINES = 80;
const MAX_PARAMETER_COUNT = 5;
const MAX_ARROW_EXPRESSION_CHARS = 100;

function bodyLineCount(body: { getStart(): number; getEnd(): number }, sourceFile: SourceFile): number {
  const start = sourceFile.getLineAndCharacterOfPosition(body.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(body.getEnd());
  return end.line - start.line + 1;
}

function parameterCount(node: { parameters: readonly unknown[] }): number {
  return node.parameters.length;
}

function report(
  findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[],
  sourceFile: SourceFile,
  node: Node,
  message: string,
): void {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  findings.push({
    severity: 'warning',
    message,
    line: position.line + 1,
    column: position.character + 1,
  });
}

export const noCodeBloat: Rule = {
  id: 'no-code-bloat',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

    function visit(node: Node): void {
      const isFunction =
        ast.isFunctionDeclaration(node) ||
        ast.isFunctionExpression(node) ||
        ast.isArrowFunction(node) ||
        ast.isMethodDeclaration(node);
      if (isFunction) {
        if (node.body && ast.isBlock(node.body) && bodyLineCount(node.body, sourceFile) > MAX_FUNCTION_BODY_LINES) {
          report(findings, sourceFile, node, `Function body exceeds ${MAX_FUNCTION_BODY_LINES} lines`);
        }
        if (parameterCount(node) > MAX_PARAMETER_COUNT) {
          report(findings, sourceFile, node, `Function has ${node.parameters.length} parameters (max ${MAX_PARAMETER_COUNT})`);
        }
        if (ast.isArrowFunction(node) && node.body && !ast.isBlock(node.body)) {
          const length = node.body.getEnd() - node.body.getStart();
          if (length > MAX_ARROW_EXPRESSION_CHARS) {
            report(findings, sourceFile, node, `Arrow function expression body exceeds ${MAX_ARROW_EXPRESSION_CHARS} characters`);
          }
        }
      }
      node.forEachChild(visit);
    }
    visit(sourceFile);

    return findings;
  },
};

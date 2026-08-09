import {
  ast,
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type Node,
  type ParameterDeclaration,
  type SourceFile,
} from '../ts-api';
import type { Diagnostic, Rule } from '../types';

type WrapperCandidate = FunctionDeclaration | ArrowFunction;

function paramName(parameter: ParameterDeclaration): string | undefined {
  return ast.isIdentifier(parameter.name) ? parameter.name.text : undefined;
}

function isPureForwarder(node: WrapperCandidate): boolean {
  const parameters = node.parameters;
  if (!parameters || parameters.some((parameter) => paramName(parameter) === undefined)) return false;
  const body = node.body;
  if (!body) return false;
  let call: CallExpression | undefined;
  if (ast.isBlock(body)) {
    if (body.statements.length !== 1) return false;
    const only = body.statements[0];
    if (!ast.isReturnStatement(only) || !only.expression) return false;
    if (!ast.isCallExpression(only.expression)) return false;
    call = only.expression;
  } else {
    if (!ast.isCallExpression(body)) return false;
    call = body;
  }
  if (call.arguments.length !== parameters.length) return false;
  return call.arguments.every(
    (argument, index) => ast.isIdentifier(argument) && argument.text === paramName(parameters[index]),
  );
}

function collectCandidates(sourceFile: SourceFile): WrapperCandidate[] {
  const candidates: WrapperCandidate[] = [];
  function visit(node: Node): void {
    if (ast.isFunctionDeclaration(node) || ast.isArrowFunction(node)) {
      candidates.push(node);
    }
    node.forEachChild(visit);
  }
  visit(sourceFile);
  return candidates;
}

export const noOverWrapper: Rule = {
  id: 'no-over-wrapper',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    for (const candidate of collectCandidates(sourceFile)) {
      if (!isPureForwarder(candidate)) continue;
      const position = sourceFile.getLineAndCharacterOfPosition(candidate.getStart());
      findings.push({
        severity: 'warning',
        message: 'Function only forwards its arguments to another call',
        line: position.line + 1,
        column: position.character + 1,
      });
    }
    return findings;
  },
};

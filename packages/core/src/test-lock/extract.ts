import { ast, type CallExpression, type Expression, type Node, type SourceFile } from '../slop-scanner/ts-api.js';
import type { AssertionInfo, TestCaseInfo } from './types.js';

const TEST_NAMES = new Set(['it', 'test', 'describe', 'xit', 'xtest', 'xdescribe']);

const ASSERTION_NAMES = new Set([
  'expect',
  'assert',
  'assertEquals',
  'assertNotEquals',
  'assertStrictEqual',
  'assertNotStrictEqual',
  'assertDeepEqual',
  'assertNotDeepEqual',
  'assertThat',
  'assertTrue',
  'assertFalse',
  'assertNull',
  'assertNotNull',
  'assertUndefined',
  'assertDefined',
  'assertSame',
  'assertNotSame',
  'assertThrows',
  'assertRejects',
  'assertMatch',
  'assertContains',
  'assertDoesNotContain',
  'assertExists',
  'assertTruthy',
  'assertFalsy',
  'assertFail',
]);

const MOCK_NAME = /mock|stub|spy|fake/i;

const UNARY_OPERATOR_TEXT: Record<number, string> = {
  [ast.SyntaxKind.PlusToken]: '+',
  [ast.SyntaxKind.MinusToken]: '-',
  [ast.SyntaxKind.ExclamationToken]: '!',
  [ast.SyntaxKind.TildeToken]: '~',
};

const BINARY_OPERATOR_TEXT: Record<number, string> = {
  [ast.SyntaxKind.PlusToken]: '+',
  [ast.SyntaxKind.MinusToken]: '-',
  [ast.SyntaxKind.AsteriskToken]: '*',
  [ast.SyntaxKind.SlashToken]: '/',
  [ast.SyntaxKind.PercentToken]: '%',
  [ast.SyntaxKind.AmpersandAmpersandToken]: '&&',
  [ast.SyntaxKind.BarBarToken]: '||',
  [ast.SyntaxKind.QuestionQuestionToken]: '??',
  [ast.SyntaxKind.EqualsEqualsToken]: '==',
  [ast.SyntaxKind.ExclamationEqualsToken]: '!=',
  [ast.SyntaxKind.EqualsEqualsEqualsToken]: '===',
  [ast.SyntaxKind.ExclamationEqualsEqualsToken]: '!==',
  [ast.SyntaxKind.LessThanToken]: '<',
  [ast.SyntaxKind.LessThanEqualsToken]: '<=',
  [ast.SyntaxKind.GreaterThanToken]: '>',
  [ast.SyntaxKind.GreaterThanEqualsToken]: '>=',
};

function lineOf(node: Node, sourceFile: SourceFile): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

function isTestDeclarationCall(call: CallExpression): boolean {
  const callee = call.expression;
  if (ast.isIdentifier(callee)) return TEST_NAMES.has(callee.text);
  if (ast.isPropertyAccessExpression(callee) && ast.isIdentifier(callee.expression)) {
    const root = callee.expression.text;
    const property = callee.name.text;
    return TEST_NAMES.has(root) && (property === 'skip' || property === 'only');
  }
  return false;
}

function rootIdentifier(expression: Expression): string | undefined {
  let current = expression;
  while (ast.isPropertyAccessExpression(current)) current = current.expression;
  return ast.isIdentifier(current) ? current.text : undefined;
}

function isMockCall(call: CallExpression): boolean {
  const callee = call.expression;
  const root = rootIdentifier(callee);
  if (!root) return false;
  if ((root === 'jest' || root === 'vi') && ast.isPropertyAccessExpression(callee)) return true;
  return MOCK_NAME.test(root);
}

function isChainInnerCall(call: CallExpression): boolean {
  const parent = call.parent as Node | undefined;
  return (
    parent !== undefined &&
    ast.isPropertyAccessExpression(parent) &&
    (parent.expression as Node) === call
  );
}

function classifyAssertion(call: CallExpression, chainBase: boolean): string | undefined {
  if (!chainBase && isChainInnerCall(call)) return undefined;
  const callee = call.expression;
  if (ast.isIdentifier(callee)) {
    return ASSERTION_NAMES.has(callee.text) ? callee.text : undefined;
  }
  if (!ast.isPropertyAccessExpression(callee)) return undefined;
  let base: Expression = callee;
  while (ast.isPropertyAccessExpression(base)) base = base.expression;
  if (ast.isIdentifier(base)) {
    return base.text === 'assert' || base.text === 't' ? base.text : undefined;
  }
  if (ast.isCallExpression(base)) {
    return classifyAssertion(base, true) === 'expect' ? 'expect' : undefined;
  }
  return undefined;
}

function classifyAssertionCall(call: CallExpression): string | undefined {
  return classifyAssertion(call, false);
}

function serialize(node: Node): string {
  if (ast.isIdentifier(node)) return node.text;
  if (ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node)) return `str:${node.text}`;
  if (ast.isNumericLiteral(node)) return `num:${node.text}`;
  if (node.kind === ast.SyntaxKind.TrueKeyword) return 'bool:true';
  if (node.kind === ast.SyntaxKind.FalseKeyword) return 'bool:false';
  if (node.kind === ast.SyntaxKind.NullKeyword) return 'null';
  if (ast.isCallExpression(node)) {
    return `${serialize(node.expression)}(${node.arguments.map((argument) => serialize(argument)).join(',')})`;
  }
  if (ast.isPropertyAccessExpression(node)) return `${serialize(node.expression)}.${node.name.text}`;
  if (ast.isPrefixUnaryExpression(node)) {
    return `${UNARY_OPERATOR_TEXT[node.operator] ?? `op:${node.operator}`}${serialize(node.operand)}`;
  }
  if (ast.isBinaryExpression(node)) {
    return `${serialize(node.left)} ${BINARY_OPERATOR_TEXT[node.operatorToken.kind] ?? `op:${node.operatorToken.kind}`} ${serialize(node.right)}`;
  }
  if (ast.isParenthesizedExpression(node)) return `(${serialize(node.expression)})`;
  if (ast.isObjectLiteralExpression(node)) return `{${node.properties.map((property) => serialize(property)).join(',')}}`;
  if (ast.isPropertyAssignment(node)) return `${serialize(node.name)}:${serialize(node.initializer)}`;
  if (ast.isArrayLiteralExpression(node)) return `[${node.elements.map((element) => serialize(element)).join(',')}]`;
  if (ast.isArrowFunction(node)) return '()=>';
  if (ast.isFunctionExpression(node)) return 'fn()';
  return `kind:${ast.SyntaxKind[node.kind]}`;
}

function collectAssertions(testCall: CallExpression, sourceFile: SourceFile): AssertionInfo[] {
  const callback = testCall.arguments[1];
  if (!callback) return [];
  const assertions: AssertionInfo[] = [];

  function visit(node: Node): void {
    if (ast.isCallExpression(node)) {
      if (isTestDeclarationCall(node)) return; // assertion milik test bertingkat
      const kind = classifyAssertionCall(node);
      if (kind !== undefined) {
        assertions.push({ kind, argsShape: serialize(node), line: lineOf(node, sourceFile) });
      }
    }
    node.forEachChild(visit);
  }
  visit(callback);
  return assertions;
}

function collectMockStats(callback: Node): { mockCalls: number; statements: number } {
  let mockCalls = 0;
  let statements = 0;

  function visit(node: Node): void {
    if (
      ast.isExpressionStatement(node) &&
      ast.isCallExpression(node.expression) &&
      isTestDeclarationCall(node.expression)
    ) {
      return;
    }
    if (ast.isCallExpression(node)) {
      if (isTestDeclarationCall(node)) return;
      if (isMockCall(node)) mockCalls++;
    }
    if (ast.isStatement(node) && !ast.isBlock(node)) statements++;
    node.forEachChild(visit);
  }
  visit(callback);
  return { mockCalls, statements };
}

export function extractTests(sourceFile: SourceFile): TestCaseInfo[] {
  const tests: TestCaseInfo[] = [];

  function visit(node: Node): void {
    if (ast.isCallExpression(node) && isTestDeclarationCall(node)) {
      const callee = node.expression;
      const rootName = ast.isIdentifier(callee)
        ? callee.text
        : ast.isPropertyAccessExpression(callee) && ast.isIdentifier(callee.expression)
          ? callee.expression.text
          : '';
      const propertyName = ast.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
      const skipped = propertyName === 'skip' || rootName.startsWith('x');
      const kindName = rootName.startsWith('x') ? rootName.slice(1) : rootName;
      const kind = kindName === 'test' || kindName === 'describe' ? kindName : 'it';
      const firstArgument = node.arguments[0];
      const name =
        firstArgument === undefined
          ? '<anonymous>'
          : ast.isStringLiteral(firstArgument)
            ? firstArgument.text
            : serialize(firstArgument);
      const callback = node.arguments[1];
      const mockStats = callback ? collectMockStats(callback) : { mockCalls: 0, statements: 0 };

      tests.push({
        name,
        kind,
        skipped,
        line: lineOf(node, sourceFile),
        ...mockStats,
        assertions: collectAssertions(node, sourceFile),
      });
    }
    node.forEachChild(visit);
  }
  visit(sourceFile);
  return tests;
}

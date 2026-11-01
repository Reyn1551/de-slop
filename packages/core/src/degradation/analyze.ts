import { ast, type Node, type SourceFile } from '../slop-scanner/ts-api';
import { parseSourceFile } from '../slop-scanner/scanner';
import type { FileMetrics, FunctionMetric, ProjectMetrics } from './types';

const CLONE_WINDOW = 5;
const EROSION_CYCLOMATIC_THRESHOLD = 10;
const ANONYMOUS_FUNCTION = '<anonymous>';

interface SourceLines {
  lines: string[];
  codeLines: boolean[];
}

interface LineScanState {
  inBlockComment: boolean;
  inTemplate: boolean;
}

interface FunctionShape {
  name: string;
  body: Node | undefined;
}

function functionShape(node: Node): FunctionShape | undefined {
  if (ast.isFunctionDeclaration(node) || ast.isFunctionExpression(node) || ast.isMethodDeclaration(node)) {
    const name = node.name;
    return {
      name: name && (ast.isIdentifier(name) || ast.isStringLiteral(name)) ? name.text : ANONYMOUS_FUNCTION,
      body: node.body,
    };
  }
  if (ast.isArrowFunction(node)) return { name: ANONYMOUS_FUNCTION, body: node.body };
  if (ast.isConstructorDeclaration(node)) return { name: 'constructor', body: node.body };
  if (ast.isGetAccessorDeclaration(node) || ast.isSetAccessorDeclaration(node)) {
    const name = node.name;
    return { name: ast.isIdentifier(name) ? name.text : ANONYMOUS_FUNCTION, body: node.body };
  }
  return undefined;
}

function complexityWeight(node: Node): number {
  if (
    ast.isIfStatement(node) ||
    ast.isForStatement(node) ||
    ast.isForInStatement(node) ||
    ast.isForOfStatement(node) ||
    ast.isWhileStatement(node) ||
    ast.isDoStatement(node) ||
    ast.isCaseClause(node) ||
    ast.isCatchClause(node) ||
    ast.isConditionalExpression(node)
  ) {
    return 1;
  }
  if (ast.isBinaryExpression(node)) {
    const kind = node.operatorToken.kind;
    if (
      kind === ast.SyntaxKind.AmpersandAmpersandToken ||
      kind === ast.SyntaxKind.BarBarToken ||
      kind === ast.SyntaxKind.QuestionQuestionToken
    ) {
      return 1;
    }
  }
  if (
    (ast.isPropertyAccessExpression(node) || ast.isElementAccessExpression(node) || ast.isCallExpression(node)) &&
    node.questionDotToken
  ) {
    return 1;
  }
  return 0;
}

function cyclomaticComplexity(node: Node): number {
  let complexity = 1;
  const visit = (child: Node): void => {
    if (functionShape(child)) return;
    complexity += complexityWeight(child);
    child.forEachChild(visit);
  };
  const body = functionShape(node)?.body;
  if (body) visit(body);
  return complexity;
}

function collectFunctions(sourceFile: SourceFile): { node: Node; shape: FunctionShape }[] {
  const functions: { node: Node; shape: FunctionShape }[] = [];
  const visit = (node: Node): void => {
    const shape = functionShape(node);
    if (shape?.body) functions.push({ node, shape });
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return functions;
}

function isBooleanLiteral(node: Node): boolean {
  return node.kind === ast.SyntaxKind.TrueKeyword || node.kind === ast.SyntaxKind.FalseKeyword;
}

function isLengthAccess(node: Node): boolean {
  return ast.isPropertyAccessExpression(node) && ast.isIdentifier(node.name) && node.name.text === 'length';
}

function isBooleanComparison(node: Node): boolean {
  if (!ast.isBinaryExpression(node)) return false;
  const kind = node.operatorToken.kind;
  if (kind !== ast.SyntaxKind.EqualsEqualsEqualsToken && kind !== ast.SyntaxKind.ExclamationEqualsEqualsToken) {
    return false;
  }
  return isBooleanLiteral(node.left) || isBooleanLiteral(node.right);
}

function bareReturnExpression(statement: Node | undefined): Node | undefined {
  if (!statement) return undefined;
  if (ast.isReturnStatement(statement)) return statement.expression;
  if (ast.isBlock(statement) && statement.statements.length === 1) {
    const only = statement.statements[0];
    return ast.isReturnStatement(only) ? only.expression : undefined;
  }
  return undefined;
}

function isBooleanReturnIf(node: Node): boolean {
  if (!ast.isIfStatement(node)) return false;
  const thenExpression = bareReturnExpression(node.thenStatement);
  const elseExpression = bareReturnExpression(node.elseStatement);
  return thenExpression !== undefined && elseExpression !== undefined && isBooleanLiteral(thenExpression) && isBooleanLiteral(elseExpression);
}

function isLengthConditional(node: Node): boolean {
  if (!ast.isConditionalExpression(node) || !ast.isBinaryExpression(node.condition)) return false;
  const condition = node.condition;
  const kind = condition.operatorToken.kind;
  if (
    kind !== ast.SyntaxKind.GreaterThanToken &&
    kind !== ast.SyntaxKind.GreaterThanEqualsToken &&
    kind !== ast.SyntaxKind.ExclamationEqualsEqualsToken
  ) {
    return false;
  }
  const zeroLeft = ast.isNumericLiteral(condition.left) && Number(condition.left.text) === 0;
  const zeroRight = ast.isNumericLiteral(condition.right) && Number(condition.right.text) === 0;
  return (
    (isLengthAccess(condition.left) && zeroRight) ||
    (isLengthAccess(condition.right) && zeroLeft)
  );
}

function isEmptyElseBlock(node: Node): boolean {
  return (
    ast.isIfStatement(node) &&
    node.elseStatement !== undefined &&
    ast.isBlock(node.elseStatement) &&
    node.elseStatement.statements.length === 0
  );
}

function endsWithReturn(statement: Node): boolean {
  if (ast.isReturnStatement(statement)) return true;
  if (ast.isBlock(statement) && statement.statements.length > 0) {
    return ast.isReturnStatement(statement.statements[statement.statements.length - 1]);
  }
  return false;
}

function isRedundantElseReturn(node: Node): boolean {
  if (!ast.isIfStatement(node)) return false;
  const elseBranch = node.elseStatement;
  if (!elseBranch || !ast.isBlock(elseBranch) || elseBranch.statements.length !== 1) return false;
  const elseStatement = elseBranch.statements[0];
  if (!ast.isReturnStatement(elseStatement) || elseStatement.expression !== undefined) return false;
  return endsWithReturn(node.thenStatement);
}

function isStringTemplateCall(node: Node): boolean {
  if (!ast.isCallExpression(node) || !ast.isIdentifier(node.expression) || node.expression.text !== 'String') {
    return false;
  }
  if (node.arguments.length !== 1) return false;
  const argument = node.arguments[0];
  return ast.isTemplateExpression(argument) || ast.isNoSubstitutionTemplateLiteral(argument);
}

function isAwaitPromiseResolve(node: Node): boolean {
  if (!ast.isAwaitExpression(node) || !ast.isCallExpression(node.expression)) return false;
  const callee = node.expression.expression;
  return (
    ast.isPropertyAccessExpression(callee) &&
    ast.isIdentifier(callee.expression) &&
    callee.expression.text === 'Promise' &&
    ast.isIdentifier(callee.name) &&
    callee.name.text === 'resolve'
  );
}

function isTypeofUndefinedCheck(node: Node): boolean {
  if (!ast.isBinaryExpression(node)) return false;
  const kind = node.operatorToken.kind;
  if (kind !== ast.SyntaxKind.ExclamationEqualsEqualsToken && kind !== ast.SyntaxKind.EqualsEqualsEqualsToken) {
    return false;
  }
  const leftIsUndefined = ast.isStringLiteral(node.left) && node.left.text === 'undefined';
  const rightIsUndefined = ast.isStringLiteral(node.right) && node.right.text === 'undefined';
  return (
    (ast.isTypeOfExpression(node.left) && rightIsUndefined) ||
    (ast.isTypeOfExpression(node.right) && leftIsUndefined)
  );
}

function isArrayFromMap(node: Node): boolean {
  if (!ast.isCallExpression(node) || !ast.isPropertyAccessExpression(node.expression)) return false;
  const callee = node.expression;
  if (!ast.isIdentifier(callee.name) || callee.name.text !== 'map' || !ast.isCallExpression(callee.expression)) return false;
  const inner = callee.expression.expression;
  return (
    ast.isPropertyAccessExpression(inner) &&
    ast.isIdentifier(inner.expression) &&
    inner.expression.text === 'Array' &&
    ast.isIdentifier(inner.name) &&
    inner.name.text === 'from'
  );
}

function isFlaggedConstruct(node: Node): boolean {
  return (
    (ast.isReturnStatement(node) && node.expression !== undefined && ast.isAwaitExpression(node.expression)) ||
    isBooleanComparison(node) ||
    isBooleanReturnIf(node) ||
    isLengthConditional(node) ||
    isEmptyElseBlock(node) ||
    isRedundantElseReturn(node) ||
    isStringTemplateCall(node) ||
    isAwaitPromiseResolve(node) ||
    isTypeofUndefinedCheck(node) ||
    isArrayFromMap(node)
  );
}

function collectFlaggedLines(sourceFile: SourceFile): number[] {
  const flagged = new Set<number>();
  const visit = (node: Node): void => {
    if (isFlaggedConstruct(node)) {
      flagged.add(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return [...flagged].sort((a, b) => a - b);
}

function normalizeLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed === '{' || trimmed === '}') return '';
  return trimmed.replace(/\s+/g, ' ');
}

function collectCloneLines(lines: string[]): number[] {
  const entries: { line: number; normalized: string }[] = [];
  for (let index = 0; index < lines.length; index++) {
    const normalized = normalizeLine(lines[index]);
    if (normalized !== '') entries.push({ line: index + 1, normalized });
  }

  const windows = new Map<string, number[]>();
  for (let start = 0; start + CLONE_WINDOW <= entries.length; start++) {
    const key = entries
      .slice(start, start + CLONE_WINDOW)
      .map((entry) => entry.normalized)
      .join('\n');
    const starts = windows.get(key);
    if (starts) starts.push(start);
    else windows.set(key, [start]);
  }

  const cloneLines = new Set<number>();
  for (const starts of windows.values()) {
    if (starts.length < 2) continue;
    for (const start of starts) {
      for (let offset = 0; offset < CLONE_WINDOW; offset++) {
        cloneLines.add(entries[start + offset].line);
      }
    }
  }
  return [...cloneLines].sort((a, b) => a - b);
}

function lineHasCode(line: string, state: LineScanState): boolean {
  let hasCode = false;
  let quote: '"' | "'" | null = null;
  let index = 0;

  while (index < line.length) {
    const char = line[index];

    if (state.inBlockComment) {
      if (char === '*' && line[index + 1] === '/') {
        state.inBlockComment = false;
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }

    if (state.inTemplate) {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === '`') {
        state.inTemplate = false;
        index += 1;
        continue;
      }
      if (!/\s/.test(char)) hasCode = true;
      index += 1;
      continue;
    }

    if (quote) {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = null;
        index += 1;
        continue;
      }
      if (!/\s/.test(char)) hasCode = true;
      index += 1;
      continue;
    }

    if (char === '/' && line[index + 1] === '/') break;
    if (char === '/' && line[index + 1] === '*') {
      state.inBlockComment = true;
      index += 2;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      hasCode = true;
      index += 1;
      continue;
    }
    if (char === '`') {
      state.inTemplate = true;
      hasCode = true;
      index += 1;
      continue;
    }
    if (!/\s/.test(char)) hasCode = true;
    index += 1;
  }

  return hasCode;
}

function analyzeLines(text: string): SourceLines {
  if (text === '') return { lines: [], codeLines: [] };
  const lines = text.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  const state: LineScanState = { inBlockComment: false, inTemplate: false };
  return { lines, codeLines: lines.map((line) => lineHasCode(line, state)) };
}

function countCodeLines(codeLines: boolean[], startIndex: number, endIndex: number): number {
  let count = 0;
  for (let index = Math.max(startIndex, 0); index <= endIndex && index < codeLines.length; index++) {
    if (codeLines[index]) count += 1;
  }
  return count;
}

function functionMetric(node: Node, name: string, sourceFile: SourceFile, codeLines: boolean[]): FunctionMetric {
  const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const endLine = sourceFile.getLineAndCharacterOfPosition(Math.max(node.getStart(), node.getEnd() - 1)).line + 1;
  const sloc = countCodeLines(codeLines, startLine - 1, endLine - 1);
  const cyclomatic = cyclomaticComplexity(node);
  return {
    name,
    startLine,
    cyclomatic,
    sloc,
    mass: cyclomatic * Math.sqrt(sloc),
  };
}

function massTotals(functions: FunctionMetric[]): { total: number; eroded: number } {
  let total = 0;
  let eroded = 0;
  for (const fn of functions) {
    total += fn.mass;
    if (fn.cyclomatic > EROSION_CYCLOMATIC_THRESHOLD) eroded += fn.mass;
  }
  return { total, eroded };
}

export function analyzeFile(code: string, filePath: string): FileMetrics {
  const sourceFile = parseSourceFile(code, filePath);
  const { lines, codeLines } = analyzeLines(code);
  const functions = collectFunctions(sourceFile).map((entry) =>
    functionMetric(entry.node, entry.shape.name, sourceFile, codeLines),
  );
  const flaggedLines = collectFlaggedLines(sourceFile);
  const cloneLines = collectCloneLines(lines);
  const loc = lines.length;
  const mass = massTotals(functions);
  const maxCyclomatic = functions.reduce((max, fn) => Math.max(max, fn.cyclomatic), 0);

  return {
    filePath,
    loc,
    sloc: codeLines.filter(Boolean).length,
    functions,
    erosion: mass.eroded / Math.max(mass.total, 1),
    verbosity: new Set([...flaggedLines, ...cloneLines]).size / Math.max(loc, 1),
    flaggedLines,
    cloneLines,
    maxCyclomatic,
  };
}

export function analyzeProject(files: { filePath: string; code: string }[]): ProjectMetrics {
  const metrics = files.map((file) => analyzeFile(file.code, file.filePath));

  let loc = 0;
  let sloc = 0;
  let functionCount = 0;
  let totalMass = 0;
  let erodedMass = 0;
  let verboseLines = 0;

  for (const file of metrics) {
    const mass = massTotals(file.functions);
    loc += file.loc;
    sloc += file.sloc;
    functionCount += file.functions.length;
    verboseLines += new Set([...file.flaggedLines, ...file.cloneLines]).size;
    totalMass += mass.total;
    erodedMass += mass.eroded;
  }

  return {
    files: metrics,
    loc,
    sloc,
    functionCount,
    erosion: erodedMass / Math.max(totalMass, 1),
    verbosity: verboseLines / Math.max(loc, 1),
  };
}

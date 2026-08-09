import { parseSourceFile } from '../slop-scanner/scanner';
import { noHardcodedSecret } from '../slop-scanner/rules/no-hardcoded-secret';
import { ast, type Node, type SourceFile } from '../slop-scanner/ts-api';
import type { Spec } from './parser';

export interface SpecViolation {
  specId: string;
  type: string;
  severity: 'error' | 'warning';
  message: string;
  filePath?: string;
  line?: number;
}

export interface SourceInput {
  filePath: string;
  code: string;
}

interface ParsedSource {
  filePath: string;
  sourceFile: SourceFile;
}

const LOG_METHODS = new Set(['log', 'warn', 'error', 'debug']);
const LOG_MARKER = 'tidak pernah di-log';
const SECRET_MARKER = 'hardcoded secret';

function violation(specId: string, type: string, message: string, extra?: { filePath?: string; line?: number }): SpecViolation {
  return { specId, type, severity: 'error', message, ...extra };
}

function lineOf(sourceFile: SourceFile, node: Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

function functionExists(name: string, sources: ParsedSource[]): boolean {
  for (const { sourceFile } of sources) {
    for (const statement of sourceFile.statements) {
      if (ast.isFunctionDeclaration(statement) && statement.name?.text === name) {
        return true;
      }
      if (ast.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ast.isIdentifier(declaration.name) && declaration.name.text === name) {
            const initializer = declaration.initializer;
            if (initializer && (ast.isArrowFunction(initializer) || ast.isFunctionExpression(initializer))) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

function subtreeContainsIdentifier(node: Node, term: string): boolean {
  let found = false;
  const visit = (current: Node): void => {
    if (found) return;
    if (ast.isIdentifier(current) && current.text.toLowerCase().includes(term.toLowerCase())) {
      found = true;
      return;
    }
    current.forEachChild(visit);
  };
  visit(node);
  return found;
}

function findLoggedSensitiveData(sourceFile: SourceFile, term: string): Node | undefined {
  let hit: Node | undefined;
  const visit = (node: Node): void => {
    if (hit) return;
    if (ast.isCallExpression(node) && ast.isPropertyAccessExpression(node.expression)) {
      const callee = node.expression;
      if (
        ast.isIdentifier(callee.expression) &&
        callee.expression.text === 'console' &&
        ast.isIdentifier(callee.name) &&
        LOG_METHODS.has(callee.name.text)
      ) {
        if (node.arguments.some((argument) => subtreeContainsIdentifier(argument, term))) {
          hit = node;
          return;
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return hit;
}

function findEvalUsages(sourceFile: SourceFile): Node[] {
  const hits: Node[] = [];
  const visit = (node: Node): void => {
    if (ast.isCallExpression(node)) {
      const callee = node.expression;
      if (
        (ast.isIdentifier(callee) && callee.text === 'eval') ||
        (ast.isPropertyAccessExpression(callee) && ast.isIdentifier(callee.name) && callee.name.text === 'eval')
      ) {
        hits.push(node);
      }
    }
    if (ast.isNewExpression(node) && ast.isIdentifier(node.expression) && node.expression.text === 'Function') {
      hits.push(node);
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return hits;
}

function checkLogInvariant(specId: string, invariant: string, sources: ParsedSource[]): SpecViolation[] {
  const lower = invariant.toLowerCase();
  const markerIndex = lower.indexOf(LOG_MARKER);
  if (markerIndex < 0) return [];
  const words = invariant.slice(0, markerIndex).trim().split(/\s+/);
  const sensitiveWord = words[words.length - 1] ?? '';
  if (!sensitiveWord) return [];
  const out: SpecViolation[] = [];
  for (const { filePath, sourceFile } of sources) {
    const hit = findLoggedSensitiveData(sourceFile, sensitiveWord);
    if (hit) {
      out.push(
        violation(specId, 'log-sensitive-data', `Invariant '${invariant}': sensitive data '${sensitiveWord}' is logged`, {
          filePath,
          line: lineOf(sourceFile, hit),
        }),
      );
    }
  }
  return out;
}

function checkSecretInvariant(specId: string, invariant: string, sources: SourceInput[]): SpecViolation[] {
  const out: SpecViolation[] = [];
  for (const source of sources) {
    let sourceFile: SourceFile;
    try {
      sourceFile = parseSourceFile(source.code, source.filePath);
    } catch {
      continue;
    }
    for (const finding of noHardcodedSecret.check(sourceFile)) {
      out.push({
        specId,
        type: 'hardcoded-secret',
        severity: finding.severity,
        message: `Invariant '${invariant}': ${finding.message}`,
        filePath: source.filePath,
        line: finding.line,
      });
    }
  }
  return out;
}

function checkEvalInvariant(specId: string, invariant: string, sources: ParsedSource[]): SpecViolation[] {
  const out: SpecViolation[] = [];
  for (const { filePath, sourceFile } of sources) {
    for (const hit of findEvalUsages(sourceFile)) {
      out.push(
        violation(specId, 'eval-usage', `Invariant '${invariant}': dynamic code execution found`, {
          filePath,
          line: lineOf(sourceFile, hit),
        }),
      );
    }
  }
  return out;
}

function checkInvariant(
  specId: string,
  invariant: string,
  sources: SourceInput[],
  parsed: ParsedSource[],
): SpecViolation[] {
  if (invariant.toLowerCase().includes(LOG_MARKER)) {
    return checkLogInvariant(specId, invariant, parsed);
  }
  if (invariant.toLowerCase().includes(SECRET_MARKER)) {
    return checkSecretInvariant(specId, invariant, sources);
  }
  if (/\beval\b/.test(invariant.toLowerCase())) {
    return checkEvalInvariant(specId, invariant, parsed);
  }
  return [
    {
      specId,
      type: 'unknown-invariant',
      severity: 'warning',
      message: `Invariant '${invariant}' is not recognized by spec-contractor`,
    },
  ];
}

export function verifySpec(spec: Spec, sources: SourceInput[]): SpecViolation[] {
  const out: SpecViolation[] = [];
  const parsed: ParsedSource[] = [];

  for (const source of sources) {
    try {
      parsed.push({ filePath: source.filePath, sourceFile: parseSourceFile(source.code, source.filePath) });
    } catch (error) {
      out.push(
        violation(spec.id, 'parse-error', `Failed to parse ${source.filePath}: ${(error as Error).message}`, {
          filePath: source.filePath,
        }),
      );
    }
  }

  for (const name of spec.functions) {
    if (!functionExists(name, parsed)) {
      out.push(violation(spec.id, 'missing-function', `Function '${name}' declared in spec not found in sources`));
    }
  }

  for (const invariant of spec.invariants) {
    out.push(...checkInvariant(spec.id, invariant, sources, parsed));
  }

  return out;
}

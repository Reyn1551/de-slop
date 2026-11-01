import { ast, type SourceFile, type Node } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

// An exported function or class without a JSDoc block. Types, interfaces, and
// exported constants are excluded: their signature already documents them, and
// demanding a comment above every `export interface Foo {` produces exactly the
// redundant comment this project exists to remove.

function hasJSDoc(node: Node, text: string): boolean {
  for (const range of ast.getLeadingCommentRanges(text, node.getFullStart()) ?? []) {
    if (range.kind === ast.SyntaxKind.MultiLineCommentTrivia) {
      const slice = text.slice(range.pos, range.pos + 3);
      if (slice === '/**') return true;
    }
  }
  return false;
}

function isExported(node: Node): boolean {
  const withModifiers = node as unknown as { modifiers?: Array<{ kind: number }> };
  for (const modifier of withModifiers.modifiers ?? []) {
    if (modifier.kind === ast.SyntaxKind.ExportKeyword ||
        modifier.kind === ast.SyntaxKind.DefaultKeyword) {
      return true;
    }
  }
  return false;
}

function report(
  findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[],
  sourceFile: SourceFile,
  node: Node,
  kind: string,
  name: string,
): void {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  findings.push({
    severity: 'warning',
    message: `Exported ${kind} '${name}' has no JSDoc comment`,
    line: position.line + 1,
    column: position.character + 1,
  });
}

export const noMissingDocs: Rule = {
  id: 'no-missing-docs',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const text = sourceFile.text;

    for (const statement of sourceFile.statements) {
      if (!isExported(statement)) continue;
      if (hasJSDoc(statement, text)) continue;

      if (ast.isFunctionDeclaration(statement)) {
        report(findings, sourceFile, statement, 'function', statement.name?.text ?? 'anonymous');
      } else if (ast.isClassDeclaration(statement)) {
        report(findings, sourceFile, statement, 'class', statement.name?.text ?? 'anonymous');
      }
    }

    return findings;
  },
};

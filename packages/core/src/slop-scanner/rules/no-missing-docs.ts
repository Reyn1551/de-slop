import { ast, type SourceFile, type Node } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

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

export const noMissingDocs: Rule = {
  id: 'no-missing-docs',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const text = sourceFile.text;

    function visit(node: Node): void {
      if (ast.isSourceFile(node)) {
        for (const statement of node.statements) {
          if (ast.isFunctionDeclaration(statement) && isExported(statement) && !hasJSDoc(statement, text)) {
            const name = statement.name?.text ?? 'anonymous';
            const position = sourceFile.getLineAndCharacterOfPosition(statement.getStart());
            findings.push({
              severity: 'warning',
              message: `Exported function '${name}' has no JSDoc comment`,
              line: position.line + 1,
              column: position.character + 1,
            });
          }
          if (ast.isClassDeclaration(statement) && isExported(statement) && !hasJSDoc(statement, text)) {
            const name = statement.name?.text ?? 'anonymous';
            const position = sourceFile.getLineAndCharacterOfPosition(statement.getStart());
            findings.push({
              severity: 'warning',
              message: `Exported class '${name}' has no JSDoc comment`,
              line: position.line + 1,
              column: position.character + 1,
            });
          }
          if (ast.isVariableStatement(statement) && isExported(statement)) {
            for (const decl of statement.declarationList.declarations) {
              if (!hasJSDoc(decl, text)) {
                const name = decl.name.getText(sourceFile);
                const position = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
                findings.push({
                  severity: 'warning',
                  message: `Exported variable '${name}' has no JSDoc comment`,
                  line: position.line + 1,
                  column: position.character + 1,
                });
              }
            }
          }
          if (ast.isInterfaceDeclaration(statement) && isExported(statement) && !hasJSDoc(statement, text)) {
            const name = statement.name?.text ?? 'anonymous';
            const position = sourceFile.getLineAndCharacterOfPosition(statement.getStart());
            findings.push({
              severity: 'warning',
              message: `Exported interface '${name}' has no JSDoc comment`,
              line: position.line + 1,
              column: position.character + 1,
            });
          }
          if (ast.isTypeAliasDeclaration(statement) && isExported(statement) && !hasJSDoc(statement, text)) {
            const name = statement.name?.text ?? 'anonymous';
            const position = sourceFile.getLineAndCharacterOfPosition(statement.getStart());
            findings.push({
              severity: 'warning',
              message: `Exported type '${name}' has no JSDoc comment`,
              line: position.line + 1,
              column: position.character + 1,
            });
          }
        }
      }
      node.forEachChild(visit);
    }
    visit(sourceFile);
    return findings;
  },
};
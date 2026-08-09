import { ast, type Node, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

export const noEmptyCatch: Rule = {
  id: 'no-empty-catch',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    function visit(node: Node): void {
      if (ast.isCatchClause(node) && node.block.statements.length === 0) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        findings.push({
          severity: 'warning',
          message: 'Catch block swallows errors silently',
          line: position.line + 1,
          column: position.character + 1,
        });
      }
      node.forEachChild(visit);
    }
    visit(sourceFile);
    return findings;
  },
};

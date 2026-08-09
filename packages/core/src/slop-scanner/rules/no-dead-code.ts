import { ast, type Block, type Node, type SourceFile, type Statement } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

function isTerminal(statement: Statement): boolean {
  return (
    ast.isReturnStatement(statement) ||
    ast.isThrowStatement(statement) ||
    ast.isBreakStatement(statement) ||
    ast.isContinueStatement(statement)
  );
}

function collectBlocks(sourceFile: SourceFile): (Block | SourceFile)[] {
  const blocks: (Block | SourceFile)[] = [];
  function visit(node: Node): void {
    if (ast.isBlock(node) || ast.isSourceFile(node)) {
      blocks.push(node);
    }
    node.forEachChild(visit);
  }
  visit(sourceFile);
  return blocks;
}

export const noDeadCode: Rule = {
  id: 'no-dead-code',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const text = sourceFile.text;
    for (const block of collectBlocks(sourceFile)) {
      const statements = block.statements;
      for (let index = 0; index < statements.length - 1; index++) {
        if (!isTerminal(statements[index])) continue;
        const firstDead = statements[index + 1];
        const lastDead = statements[statements.length - 1];
        const deadStart = firstDead.getStart();
        const position = sourceFile.getLineAndCharacterOfPosition(deadStart);
        let fixStart = deadStart;
        while (fixStart > 0 && (text[fixStart - 1] === ' ' || text[fixStart - 1] === '\t')) fixStart--;
        let fixEnd = lastDead.end;
        if (text[fixEnd] === '\r' && text[fixEnd + 1] === '\n') fixEnd += 2;
        else if (text[fixEnd] === '\n') fixEnd += 1;
        findings.push({
          severity: 'error',
          message: 'Unreachable statement after a terminal statement',
          line: position.line + 1,
          column: position.character + 1,
          fix: { start: fixStart, end: fixEnd, replacement: '' },
        });
        break;
      }
    }
    return findings;
  },
};

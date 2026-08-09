import { ast, type Node, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

const STOPWORDS = new Set(['this', 'that', 'function', 'returns', 'here', 'the', 'and', 'with']);



function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function significantWords(text: string): string[] {
  return words(text).filter((word) => word.length > 3 && !STOPWORDS.has(word));
}

function collectIdentifiers(node: Node, output: string[] = []): string[] {
  if (ast.isIdentifier(node)) {
    output.push(node.text.toLowerCase());
  }
  node.forEachChild((child) => {
    collectIdentifiers(child, output);
  });
  return output;
}

function isRedundant(commentText: string, statementText: string, statement: Node): boolean {
  const commentWords = significantWords(commentText);
  const statementWords = new Set(significantWords(statementText));
  if (commentWords.length >= 2 && commentWords.every((word) => statementWords.has(word))) {
    return true;
  }
  const statementWordList = significantWords(statementText);
  const commentWordSet = new Set(commentWords);
  if (
    statementWordList.length >= 2 &&
    commentWords.length > 0 &&
    statementWordList.every((word) => commentWordSet.has(word))
  ) {
    return true;
  }
  if (words(commentText).length < 10) {
    return collectIdentifiers(statement).some((identifier) => words(commentText).includes(identifier));
  }
  return false;
}

function collectStatements(sourceFile: SourceFile): Node[] {
  const statements: Node[] = [];
  function visit(node: Node): void {
    if (ast.isSourceFile(node) || ast.isBlock(node)) {
      for (const statement of node.statements) {
        statements.push(statement);
      }
    }
    node.forEachChild(visit);
  }
  visit(sourceFile);
  return statements;
}

export const noRedundantComment: Rule = {
  id: 'no-redundant-comment',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const text = sourceFile.text;
    for (const statement of collectStatements(sourceFile)) {
      for (const range of ast.getLeadingCommentRanges(text, statement.getFullStart()) ?? []) {
        if (range.kind !== ast.SyntaxKind.SingleLineCommentTrivia) continue;
        const commentText = text.slice(range.pos + 2, range.end);
        if (!isRedundant(commentText, statement.getText(), statement)) continue;
        const position = sourceFile.getLineAndCharacterOfPosition(range.pos);
        findings.push({
          severity: 'warning',
          message: 'Redundant comment paraphrases the code below it',
          line: position.line + 1,
          column: position.character + 1,
          fix: {
            start: range.pos,
            end: range.hasTrailingNewLine ? range.end + 1 : range.end,
            replacement: '',
          },
        });
      }
    }
    return findings;
  },
};

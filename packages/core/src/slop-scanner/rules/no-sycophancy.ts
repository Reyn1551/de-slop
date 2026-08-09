import { ast, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

const SYCOPHANCY_PATTERNS = [
  /\b(as requested|as you asked|exactly as you said|as you wanted)\b/i,
  /\b(great (point|idea|call|catch|question)|excellent (point|idea)|perfectly said|very true|well said)\b/i,
  /\b(i agree|agreed|you('re| are) (right|correct)|absolutely (right|certainly))\b/i,
  /\b(no problem at all|happy to help|glad to assist|of course it works|works as intended now)\b/i,
  /\b(totally makes sense|that makes perfect sense|makes total sense|thanks for the great feedback)\b/i,
  /\b(after your feedback|per your (request|suggestion|comment)|incorporating your (feedback|comments))\b/i,
  /\b(fixed it for you|did exactly that|just as discussed|following your lead)\b/i,
];

export const noSycophancy: Rule = {
  id: 'no-sycophancy',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const text = sourceFile.text;
    const reported = new Set<number>();

    for (const range of ast.getLeadingCommentRanges(text, 0) ?? []) {
      const commentText = text.slice(range.pos + 2, range.end);
      const matched = SYCOPHANCY_PATTERNS.find((pattern) => pattern.test(commentText));
      if (!matched || reported.has(range.pos)) continue;
      reported.add(range.pos);
      const position = sourceFile.getLineAndCharacterOfPosition(range.pos);
      findings.push({
        severity: 'warning',
        message: 'Sycophantic comment — uncritical agreement with the reviewer is an AI tell',
        line: position.line + 1,
        column: position.character + 1,
      });
    }

    function visit(node: any): void {
      if (ast.isBlock(node) || ast.isSourceFile(node)) {
        for (const statement of node.statements) {
          for (const range of ast.getLeadingCommentRanges(text, statement.getFullStart()) ?? []) {
            if (reported.has(range.pos)) continue;
            const commentText = text.slice(range.pos + 2, range.end);
            const matched = SYCOPHANCY_PATTERNS.find((pattern) => pattern.test(commentText));
            if (!matched) continue;
            reported.add(range.pos);
            const position = sourceFile.getLineAndCharacterOfPosition(range.pos);
            findings.push({
              severity: 'warning',
              message: 'Sycophantic comment — uncritical agreement with the reviewer is an AI tell',
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

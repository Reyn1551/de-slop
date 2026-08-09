import { ast, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

const ERROR_PASTE_PATTERNS = [
  /\b(cannot find (module|name)|is not defined|unexpected token|unexpected identifier)\b/i,
  /\b(cannot read propert(ies|y).*of (null|undefined)|is not a function|undefined is not a function)\b/i,
  /\b(throw new error|uncaught exception|node:|at .*\.js:\d+:\d+)\b/i,
  /\b(Error: |ERR_|MODULE_NOT_FOUND|ReferenceError|TypeError|SyntaxError|RangeError)\b/i,
  /\b(copy.?paste(d)? (the )?error|pasted the error|here('s| is) the error)\b/i,
  /\b(random(ly)? change|shotgun|just try (this|that)|trial and error|without thinking)\b/i,
];

const DEBUG_RESIDUE_PATTERN = /\b(temporar(ily|y)? logging|debug(ging)? (code|stuff|logs?)|for debugging purposes|add(ed)? a console\.log)\b/i;

export const noAcceptAll: Rule = {
  id: 'no-accept-all',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const text = sourceFile.text;

    function checkCommentRange(pos: number, end: number): void {
      const commentText = text.slice(pos + 2, end);
      const matched =
        ERROR_PASTE_PATTERNS.find((pattern) => pattern.test(commentText)) ||
        DEBUG_RESIDUE_PATTERN.test(commentText);
      if (!matched) return;
      const position = sourceFile.getLineAndCharacterOfPosition(pos);
      findings.push({
        severity: 'warning',
        message: 'Comment carries a pasted error or leftover debug note — unchecked "accept all" behavior',
        line: position.line + 1,
        column: position.character + 1,
      });
    }

    function visit(node: any): void {
      if (ast.isBlock(node) || ast.isSourceFile(node)) {
        for (const statement of node.statements) {
          for (const range of ast.getLeadingCommentRanges(text, statement.getFullStart()) ?? []) {
            if (range.kind !== ast.SyntaxKind.SingleLineCommentTrivia) continue;
            checkCommentRange(range.pos, range.end);
          }
        }
      }
      node.forEachChild(visit);
    }
    visit(sourceFile);

    return findings;
  },
};

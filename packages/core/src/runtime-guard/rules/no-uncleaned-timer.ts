import { ast, type SourceFile } from '../../slop-scanner/ts-api';
import type { Rule } from '../../slop-scanner/types';

export const noUncleanedTimer: Rule = {
  id: 'no-uncleaned-timer',
  check(sourceFile) {
    const findings: Omit<import('../../slop-scanner/types').Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const text = sourceFile.text;

    function visit(node: any): void {
      if (ast.isCallExpression(node)) {
        const callee = node.expression;
        if (ast.isIdentifier(callee)) {
          const fnName = callee.text;
          if (fnName === 'setTimeout' || fnName === 'setInterval') {
            const funcStart = node.getStart();
            const funcEnd = node.getEnd();
            const funcText = text.slice(funcStart, funcEnd);

            const hasCleanup = /\b(clearTimeout|clearInterval|useEffect|onUnmount|componentWillUnmount|cleanup|dispose)\b/.test(
              text.slice(0, funcStart),
            );

            const isInEffect = text.slice(0, funcStart).includes('useEffect');

            if (!hasCleanup && !isInEffect) {
              const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              findings.push({
                severity: 'warning',
                message: `${fnName}() without clear${fnName}() cleanup — risk of timer leak after component unmount. Use useEffect cleanup.`,
                line: pos.line + 1,
                column: pos.character + 1,
              });
            }
          }
        }
      }
      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};
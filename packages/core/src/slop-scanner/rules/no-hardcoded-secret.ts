import { ast, type Node, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

const SECRET_NAME = /api[_-]?key|secret|password|token|passwd|credential/i;
const KNOWN_PREFIX = /^(sk-|ghp_|AKIA|xox[baprs]-)/;
const PLACEHOLDER = /^(your-?api-?key|x{2,}|changeme|placeholder|example|dummy|test)$/i;

function looksLikeSecret(value: string): boolean {
  if (value.length < 8) return false;
  if (PLACEHOLDER.test(value)) return false;
  if (KNOWN_PREFIX.test(value)) return true;
  return /[a-zA-Z]/.test(value) && /\d/.test(value) && !/\s/.test(value);
}

export const noHardcodedSecret: Rule = {
  id: 'no-hardcoded-secret',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

    function report(nameNode: Node, name: string, value: string): void {
      if (!SECRET_NAME.test(name)) return;
      if (!looksLikeSecret(value)) return;
      const position = sourceFile.getLineAndCharacterOfPosition(nameNode.getStart());
      findings.push({
        severity: 'error',
        message: `Hardcoded secret assigned to '${name}'`,
        line: position.line + 1,
        column: position.character + 1,
      });
    }

    function visit(node: Node): void {
      if (ast.isVariableDeclaration(node) && node.name && ast.isIdentifier(node.name)) {
        const initializer = node.initializer;
        if (initializer && ast.isStringLiteral(initializer)) {
          report(node.name, node.name.text, initializer.text);
        }
      }
      if (ast.isPropertyAssignment(node) && ast.isIdentifier(node.name)) {
        const initializer = node.initializer;
        if (initializer && ast.isStringLiteral(initializer)) {
          report(node.name, node.name.text, initializer.text);
        }
      }
      node.forEachChild(visit);
    }
    visit(sourceFile);
    return findings;
  },
};

import { ast, type SourceFile } from '../ts-api';
import type { Diagnostic, Rule } from '../types';

const SQL_KEYWORDS = ['select', 'insert', 'update', 'delete', 'create', 'drop', 'alter', 'exec', 'sp_executesql'];
const SQL_FUNCTIONS = ['query', 'execute', 'run', 'sql', 'prepare', 'raw', 'unsafe'];
const SHELL_FUNCTIONS = ['exec', 'execSync', 'spawn', 'spawnSync', 'execFile', 'execFileSync', 'execCommand'];
const XSS_SINKS = ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'dangerouslySetInnerHTML', 'v-html'];

function textOf(node: { getText?: (sf: any) => string } | null | undefined, sourceFile: SourceFile): string {
  if (!node) return '';
  try { return node.getText!(sourceFile); } catch { return ''; }
}

function containsUserInput(expr: string): boolean {
  const lower = expr.toLowerCase();
  const userInputPatterns = ['req.body', 'req.query', 'req.params', 'req.headers', 'input', 'userinput',
    'user_input', 'user input', 'argv', 'process.argv', 'request.body', 'request.query',
    'ctx.request', 'ctx.params', 'event.body', 'message.content', 'payload', 'searchParams',
    'getElementById', 'querySelector', 'value', '.text', '.innerText', 'formData'];
  return userInputPatterns.some((p) => lower.includes(p));
}

export const noInjectionRisk: Rule = {
  id: 'no-injection-risk',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

    function visit(node: any): void {
      if (ast.isCallExpression(node)) {
        const callee = node.expression;
        const calleeText = textOf(callee, sourceFile).toLowerCase();

        if (ast.isIdentifier(callee) && SQL_FUNCTIONS.includes(calleeText)) {
          const args = node.arguments.map((a: any) => textOf(a, sourceFile));
          const full = args.join(' ');
          if (SQL_KEYWORDS.some((kw) => full.toLowerCase().includes(kw)) && containsUserInput(full)) {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              severity: 'error',
              message: `Possible SQL injection in ${calleeText}() — user input concatenated into query`,
              line: pos.line + 1,
              column: pos.character + 1,
            });
          }
        }

        if (ast.isIdentifier(callee) && SHELL_FUNCTIONS.includes(calleeText)) {
          const args = node.arguments.map((a: any) => textOf(a, sourceFile));
          const full = args.join(' ');
          if (containsUserInput(full)) {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              severity: 'error',
              message: `Possible command injection in ${calleeText}() — user input passed to shell command`,
              line: pos.line + 1,
              column: pos.character + 1,
            });
          }
        }
      }

      if (ast.isPropertyAccessExpression(node)) {
        const name = node.name?.text;
        if (name && XSS_SINKS.includes(name)) {
          const parent = node.parent;
          const rhs = textOf(parent && ast.isBinaryExpression(parent) ? parent.right : node, sourceFile);
          if (containsUserInput(rhs)) {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              severity: 'error',
              message: `Possible XSS vulnerability via ${name} — user input set as HTML`,
              line: pos.line + 1,
              column: pos.character + 1,
            });
          }
        }
      }

      if (ast.isBinaryExpression(node) && node.operatorToken?.kind === ast.SyntaxKind.PlusToken) {
        const left = textOf(node.left, sourceFile);
        const right = textOf(node.right, sourceFile);
        const concat = left + ' ' + right;
        if (SQL_KEYWORDS.some((kw) => concat.toLowerCase().includes(kw)) && containsUserInput(concat)) {
          if ((left.toLowerCase().includes('select') || left.toLowerCase().includes('where') ||
               left.toLowerCase().includes('from') || left.toLowerCase().includes('insert') ||
               left.toLowerCase().includes('update') || left.toLowerCase().includes('delete')) &&
              containsUserInput(right)) {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            findings.push({
              severity: 'error',
              message: 'Possible SQL injection — string concatenation in SQL-like context',
              line: pos.line + 1,
              column: pos.character + 1,
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
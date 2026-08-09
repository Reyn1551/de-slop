import { ast, type SourceFile } from '../../slop-scanner/ts-api';
import type { Diagnostic, Rule } from '../../slop-scanner/types';

const SECRET_INDICATORS = [
  'apiKey', 'api_key', 'apikey',
  'secret', 'secretKey', 'secret_key',
  'token', 'accessToken', 'access_token',
  'password', 'passwd', 'credential',
  'auth', 'authorization', 'authorisation',
  'jwt', 'jwtToken', 'jwt_token',
  'accessKey', 'access_key', 'privateKey', 'private_key',
  'pem', 'cert', 'ssh', 'sshKey', 'ssh_key',
];

const LOG_FUNCTIONS = ['log', 'error', 'warn', 'debug', 'info', 'trace', 'dir'];

function isLogCall(node: any): boolean {
  if (!ast.isCallExpression(node)) return false;
  const callee = node.expression;
  if (!ast.isPropertyAccessExpression(callee)) return false;
  const obj = callee.expression;
  if (!ast.isIdentifier(obj)) return false;
  if (obj.text !== 'console') return false;
  const prop = callee.name?.text;
  return typeof prop === 'string' && LOG_FUNCTIONS.includes(prop);
}

function isSecretLike(name: string): boolean {
  return SECRET_INDICATORS.some((indicator) => name.toLowerCase().includes(indicator));
}

function collectAssignedSecrets(sourceFile: SourceFile): Map<string, number> {
  const secrets = new Map<string, number>();

  function visit(node: any): void {
    // const x = ... or let x = ...
    if (ast.isVariableDeclaration(node) && node.name && ast.isIdentifier(node.name)) {
      if (isSecretLike(node.name.text)) {
        secrets.set(node.name.text, node.name.getStart());
      }
    }
    // obj.key = ... or obj[key] = ... (property assignment)
    if (ast.isBinaryExpression(node) && node.operatorToken?.kind === ast.SyntaxKind.EqualsToken) {
      const left = node.left;
      if (ast.isPropertyAccessExpression(left)) {
        const prop = left.name?.text;
        if (prop && isSecretLike(prop)) {
          secrets.set(left.getText(), left.getStart());
        }
      } else if (ast.isElementAccessExpression(left)) {
        const arg = left.argumentExpression;
        if (arg && ast.isStringLiteral(arg) && isSecretLike(arg.text)) {
          secrets.set(left.getText(), left.getStart());
        }
      }
    }
    // shorthand destructuring: { apiKey } = obj
    if (ast.isBindingElement(node) && node.name && ast.isIdentifier(node.name)) {
      if (isSecretLike(node.name.text)) {
        secrets.set(node.name.text, node.name.getStart());
      }
    }
    node.forEachChild(visit);
  }

  visit(sourceFile);
  return secrets;
}

export const noSecretLogging: Rule = {
  id: 'no-secret-logging',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const secrets = collectAssignedSecrets(sourceFile);

    if (secrets.size === 0) return findings;

    function visit(node: any): void {
      if (isLogCall(node)) {
        const args = node.arguments ?? [];
        for (const arg of args) {
          const argText = arg.getText?.() ?? '';
          for (const [secretName, secretPos] of secrets) {
            if (argText.includes(secretName)) {
              const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              findings.push({
                severity: 'error',
                message: `Secret '${secretName}' passed to console.${node.expression.name.text} — possible credential leak`,
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
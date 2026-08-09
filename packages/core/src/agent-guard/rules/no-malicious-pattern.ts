import { ast, type SourceFile } from '../../slop-scanner/ts-api';
import type { Diagnostic, Rule, RuleContext } from '../../slop-scanner/types';

function nodeText(node: any): string {
  try { return node.getText() ?? ''; } catch { return ''; }
}

function isPackageJson(filePath: string): boolean {
  return /package\.json$/.test(filePath);
}

const REVERSE_SHELL = [
  /bash\s*-i/i,
  /(^|[^\w])nc\s+(-e\s+)?[\w.-]+/,
  /sh\s+-i\s*>&?\s*\/dev\/tcp/,
  /\/bin\/sh\s+-c/,
  /child_process\.exec\s*\([^)]*\/bin\/(sh|bash)/,
];

const CREDENTIAL_NAMES = [
  'AWS_SECRET', 'AWS_ACCESS_KEY', 'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY', 'STRIPE_SECRET', 'GITHUB_TOKEN',
  'DATABASE_URL', 'API_KEY', 'PRIVATE_KEY', 'SECRET_KEY',
];

const CHILD_PROCESS_FNS = ['exec', 'execSync', 'spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork'];

function isChildProcessCall(node: any): boolean {
  if (!ast.isCallExpression(node)) return false;
  const callee = node.expression;
  if (!ast.isPropertyAccessExpression(callee)) return false;
  const prop = callee.name?.text;
  if (typeof prop !== 'string' || !CHILD_PROCESS_FNS.includes(prop)) return false;
  return nodeText(callee.expression).includes('child_process');
}

function isCredentialName(text: string): boolean {
  return CREDENTIAL_NAMES.some((n) => text.includes(n));
}

function isNetworkCall(text: string): boolean {
  return /(fetch|axios|request|got|superagent|https?\.(get|post|request)|send|emit)\(/.test(text);
}

export const noMaliciousPattern: Rule = {
  id: 'no-malicious-pattern',
  check(sourceFile, context) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const code = sourceFile.getFullText();
    const filePath = context?.filePath ?? sourceFile.fileName ?? '';

    if (isPackageJson(filePath)) {
      const lifecycleScripts = ['preinstall', 'postinstall', 'preuninstall'];
      function visitJson(node: any): void {
        if (ast.isPropertyAssignment(node)) {
          const name = node.name;
          const nameText = ast.isIdentifier(name) || ast.isStringLiteral(name) ? name.text : '';
          if (lifecycleScripts.includes(nameText)) {
            const value = node.initializer;
            if (value && ast.isStringLiteral(value)) {
              const script = value.text;
              if (/curl|wget|base64|eval|nc\s+-e|\/dev\/tcp|bash\s+-i|chmod\s+\+x|exec\s+/i.test(script)) {
                const pos = sourceFile.getLineAndCharacterOfPosition(value.getStart());
                findings.push({
                  severity: 'error',
                  message: `Suspicious ${name} script in package.json: "${script.slice(0, 80)}"`,
                  line: pos.line + 1,
                  column: pos.character + 1,
                });
              }
            }
          }
        }
        node.forEachChild(visitJson);
      }
      visitJson(sourceFile);
      return findings;
    }

    function visit(node: any): void {
      if (ast.isCallExpression(node)) {
        const callee = nodeText(node.expression);
        const args = (node.arguments ?? []).map((a: any) => nodeText(a));
        const argsFlat = args.join(' ');
        const start = node.getStart();

        // child_process.exec/spawn with reverse shell patterns
        if (isChildProcessCall(node)) {
          for (const re of REVERSE_SHELL) {
            if (re.test(argsFlat)) {
              const pos = sourceFile.getLineAndCharacterOfPosition(start);
              findings.push({
                severity: 'error',
                message: 'Possible reverse shell in child_process call',
                line: pos.line + 1,
                column: pos.character + 1,
              });
              break;
            }
          }

          // child_process + network call = exfiltration risk
          if (isNetworkCall(argsFlat)) {
            const pos = sourceFile.getLineAndCharacterOfPosition(start);
            findings.push({
              severity: 'error',
              message: 'child_process call combined with network operation — possible exfiltration',
              line: pos.line + 1,
              column: pos.character + 1,
            });
          }
        }

        // Buffer.from(data).toString('base64') + network call
        if (/Buffer\.from/.test(argsFlat) && /\.toString\s*\(\s*['"]base64['"]/.test(argsFlat) && isNetworkCall(argsFlat)) {
          const pos = sourceFile.getLineAndCharacterOfPosition(start);
          findings.push({
            severity: 'error',
            message: 'Base64-encoded data sent to network — possible exfiltration',
            line: pos.line + 1,
            column: pos.character + 1,
          });
        }

        // Credential reference in network call
        if (isNetworkCall(callee) && args.some((a) => isCredentialName(a))) {
          const pos = sourceFile.getLineAndCharacterOfPosition(start);
          findings.push({
            severity: 'error',
            message: 'Credential sent to external endpoint — possible exfiltration',
            line: pos.line + 1,
            column: pos.character + 1,
          });
        }

        // require('child_process') in non-node context
        if (callee === 'require' || /^require\s*\(/.test(callee)) {
          const arg = node.arguments[0];
          if (arg && ast.isStringLiteral(arg) && arg.text === 'child_process') {
            const pos = sourceFile.getLineAndCharacterOfPosition(start);
            findings.push({
              severity: 'warning',
              message: 'require("child_process") in unexpected context — possible backdoor',
              line: pos.line + 1,
              column: pos.character + 1,
            });
          }
        }
      }

      // socket.connect (reverse shell)
      if (ast.isPropertyAccessExpression(node) && node.name?.text === 'connect') {
        const objText = nodeText(node.expression);
        if (/(socket|net|tcp)[\s.]/i.test(objText) || objText === 'socket' || objText === 'net') {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            severity: 'error',
            message: 'socket.connect detected — possible reverse shell',
            line: pos.line + 1,
            column: pos.character + 1,
          });
        }
      }

      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};
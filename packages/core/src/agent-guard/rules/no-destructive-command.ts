import { ast, type SourceFile } from '../../slop-scanner/ts-api';
import type { Diagnostic, Rule } from '../../slop-scanner/types';

interface DestructivePattern {
  regex: RegExp;
  label: string;
}

const DESTRUCTIVE: DestructivePattern[] = [
  { regex: /\brm\s+-rf\b/gi, label: 'rm -rf' },
  { regex: /\brmdir\s+(\/s|\/q|\/s\s*\/q|\/q\s*\/s)/gi, label: 'rmdir /s (Windows)' },
  { regex: /\brmdir\s+-rf\b/gi, label: 'rmdir -rf' },
  { regex: /\bdel\s+\/f\s*\/s\b/gi, label: 'del /f /s (Windows)' },
  { regex: /\bterraform\s+(destroy|apply\s+-destroy)/gi, label: 'terraform destroy' },
  { regex: /\bdrop\s+database\b/gi, label: 'drop database' },
  { regex: /\bdrop\s+table\b/gi, label: 'drop table' },
  { regex: /\bdrop\s+schema\b/gi, label: 'drop schema' },
  { regex: /\btruncate\s+table\b/gi, label: 'truncate table' },
  { regex: /\bgit\s+checkout\s+HEAD\b/gi, label: 'git checkout HEAD' },
  { regex: /\bgit\s+reset\s+--hard\s+HEAD\b/gi, label: 'git reset --hard HEAD' },
  { regex: /\bformat\s+/gi, label: 'format' },
  { regex: /\bmkfs(?:\s|\b)/gi, label: 'mkfs' },
  { regex: /\bdd\s+if=/gi, label: 'dd if=' },
  { regex: /\bfdisk(?:\s|\b)/gi, label: 'fdisk' },
  { regex: /\bcurl\b[^|\n]*\|\s*(sh|bash)\b/gi, label: 'curl | sh' },
  { regex: /\bbash\s+-c\b/gi, label: 'bash -c' },
  { regex: /\bwget\b[^|\n]*-O\s*-\s*[^|\n]*\|\s*(sh|bash)\b/gi, label: 'wget -O - | sh' },
];

const CHILD_PROCESS_FNS = [
  'exec', 'execSync', 'spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork',
];

function scanText(
  text: string,
  basePos: number,
  sourceFile: SourceFile,
  inChildProcess: boolean,
  findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[],
): void {
  for (const pattern of DESTRUCTIVE) {
    for (const match of text.matchAll(pattern.regex)) {
      const pos = sourceFile.getLineAndCharacterOfPosition(basePos + match.index);
      const suffix = inChildProcess ? ' executed via child_process' : '';
      findings.push({
        severity: 'error',
        message: `Destructive command: "${pattern.label}"${suffix}`,
        line: pos.line + 1,
        column: pos.character + 1,
      });
    }
  }
}

function isChildProcessCall(node: any): boolean {
  if (!ast.isCallExpression(node)) return false;
  const callee = node.expression;
  const calleeText = (callee.getText?.() ?? '').toLowerCase();
  if (/child_process\./.test(calleeText)) return true;
  if (ast.isIdentifier(callee)) {
    return CHILD_PROCESS_FNS.includes(callee.text);
  }
  return false;
}

export const noDestructiveCommand: Rule = {
  id: 'no-destructive-command',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const code = sourceFile.getFullText();

    const seenChildProcessArgs = new Set<number>();

    function visit(node: any): void {
      if (isChildProcessCall(node)) {
        for (const arg of node.arguments ?? []) {
          const argText = arg.getText?.() ?? '';
          const start = arg.getStart();
          seenChildProcessArgs.add(start);
          if (ast.isStringLiteral(arg) || ast.isNoSubstitutionTemplateLiteral(arg) || ast.isTemplateExpression(arg)) {
            const raw = code.slice(start, arg.getEnd());
            scanText(raw, start, sourceFile, true, findings);
          } else {
            scanText(argText, start, sourceFile, true, findings);
          }
        }
      }

      if (ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node) || ast.isTemplateExpression(node)) {
        const start = node.getStart();
        if (!seenChildProcessArgs.has(start)) {
          const raw = code.slice(start, node.getEnd());
          scanText(raw, start, sourceFile, false, findings);
        }
      }

      node.forEachChild(visit);
    }

    visit(sourceFile);
    return findings;
  },
};
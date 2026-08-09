import { ast, type SourceFile } from '../../slop-scanner/ts-api';
import type { Diagnostic, Rule } from '../../slop-scanner/types';

interface Pattern {
  regex: RegExp;
  label: string;
  severity: 'error' | 'warning';
}

const DIRECT_INJECTION: Pattern[] = [
  { regex: /\bignore (all|any|the)? ?(previous|prior) instructions\b/i, label: 'ignore previous instructions', severity: 'error' },
  { regex: /\bignore (all|any|the)? ?(previous|prior) prompts?\b/i, label: 'ignore previous prompts', severity: 'error' },
  { regex: /\bdisregard (all|any|the)? ?(previous|prior) (instructions|prompts?)\b/i, label: 'disregard previous instructions', severity: 'error' },
  { regex: /\bforget everything (else )?(above|before|below)\b/i, label: 'forget everything', severity: 'error' },
  { regex: /\bforget (all|your) (previous|prior) instructions\b/i, label: 'forget previous instructions', severity: 'error' },
];

const SUSPICIOUS: Pattern[] = [
  { regex: /\byou are now\b/i, label: 'you are now', severity: 'warning' },
  { regex: /\byou are an? ai\b/i, label: 'you are an AI', severity: 'warning' },
  { regex: /\bact as if\b/i, label: 'act as if', severity: 'warning' },
  { regex: /\bpretend (to be|you are)\b/i, label: 'pretend to be', severity: 'warning' },
  { regex: /\bnew instructions\b/i, label: 'new instructions', severity: 'warning' },
  { regex: /\boverride (your )?(instructions|system prompt|rules|settings)\b/i, label: 'override', severity: 'warning' },
  { regex: /\bsystem prompt\b/i, label: 'system prompt', severity: 'warning' },
  { regex: /\battention:?\b/i, label: 'attention:', severity: 'warning' },
  { regex: /\byour goal is to\b/i, label: 'your goal is to', severity: 'warning' },
  { regex: /\byour task is to\b/i, label: 'your task is to', severity: 'warning' },
];

const HALLUCINATION_TELL: Pattern[] = [
  { regex: /\bi calculated this\b/i, label: 'calculated this', severity: 'warning' },
  { regex: /\bi determined that\b/i, label: 'determined that', severity: 'warning' },
];

const PATTERNS = [...DIRECT_INJECTION, ...SUSPICIOUS, ...HALLUCINATION_TELL];

function checkText(
  rawText: string,
  basePos: number,
  sourceFile: SourceFile,
  findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[],
): void {
  for (const pattern of PATTERNS) {
    const match = pattern.regex.exec(rawText);
    if (!match) continue;
    const pos = sourceFile.getLineAndCharacterOfPosition(basePos + match.index);
    findings.push({
      severity: pattern.severity,
      message: `Possible prompt injection: "${pattern.label}"`,
      line: pos.line + 1,
      column: pos.character + 1,
    });
  }
}

function collectComments(code: string): Array<{ text: string; pos: number }> {
  const comments: Array<{ text: string; pos: number }> = [];
  const re = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
  for (const match of code.matchAll(re)) {
    comments.push({ text: match[0], pos: match.index });
  }
  return comments;
}

export const noPromptInjection: Rule = {
  id: 'no-prompt-injection',
  check(sourceFile) {
    const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
    const code = sourceFile.getFullText();

    for (const comment of collectComments(code)) {
      checkText(comment.text, comment.pos, sourceFile, findings);
    }

    const seen = new Set<number>();
    function visit(node: any): void {
      const reportNode = (n: any): void => {
        const start = n.getStart(sourceFile);
        if (seen.has(start)) return;
        seen.add(start);
        const raw = code.slice(start, n.getEnd());
        checkText(raw, start, sourceFile, findings);
      };

      if (ast.isStringLiteral(node) || ast.isNoSubstitutionTemplateLiteral(node) || ast.isTemplateExpression(node)) {
        reportNode(node);
      }
      if (ast.isTemplateExpression(node)) {
        for (const span of node.templateSpans) {
          const litStart = span.literal.getStart(sourceFile);
          if (!seen.has(litStart)) {
            seen.add(litStart);
            const raw = code.slice(litStart, span.literal.getEnd());
            checkText(raw, litStart, sourceFile, findings);
          }
        }
      }
      node.forEachChild(visit);
    }
    visit(sourceFile);

    return findings;
  },
};

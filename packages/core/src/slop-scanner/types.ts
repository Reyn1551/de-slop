import type { SourceFile } from './ts-api';

export interface Diagnostic {
  ruleId: string;
  severity: 'error' | 'warning';
  message: string;
  filePath: string;
  line: number;
  column: number;
  fix?: { start: number; end: number; replacement: string };
}

export interface RuleContext {
  filePath: string;
  fileExists(path: string): boolean;
}

export type Rule = {
  id: string;
  check(sourceFile: SourceFile, context?: RuleContext): Omit<Diagnostic, 'filePath' | 'ruleId'>[];
};

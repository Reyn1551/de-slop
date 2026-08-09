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

export type Rule = {
  id: string;
  check(sourceFile: SourceFile): Omit<Diagnostic, 'filePath' | 'ruleId'>[];
};

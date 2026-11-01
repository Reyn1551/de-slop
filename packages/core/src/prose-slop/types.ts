import type { Diagnostic } from '../slop-scanner/types';

export type { Diagnostic };

export interface ProseSlopOptions {
  rules?: string[];
}

export interface ProseMetrics {
  words: number;
  sentences: number;
  paragraphs: number;
  dashes: number;
  aiWords: number;
  score: number;
}

export interface ProseScanResult {
  diagnostics: Diagnostic[];
  metrics: ProseMetrics;
}

export interface TextLocator {
  getLineAndCharacterOfPosition(pos: number): { line: number; character: number };
}

export interface ProseSpan {
  text: string;
  start: number;
}

export interface ProseContext {
  /** Prose with code fences, inline code, URLs, HTML, tables, and frontmatter blanked out. */
  text: string;
  /** Original file content, used to check for citations that masking removed. */
  raw: string;
  filePath: string;
  locator: TextLocator;
  paragraphs: ProseSpan[];
  sentences: ProseSpan[];
  words: string[];
}

export type ProseFinding = Omit<Diagnostic, 'filePath' | 'ruleId'>;

export type ProseRuleFn = (context: ProseContext) => ProseFinding[];

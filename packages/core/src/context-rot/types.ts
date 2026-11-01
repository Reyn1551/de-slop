import type { Diagnostic } from '../slop-scanner/types';

export type { Diagnostic };

/** What the repository actually contains, used to check agent instructions. */
export interface RepoFacts {
  /** Repo-relative paths with forward slashes. */
  files: string[];
  /** package.json script names. */
  scripts: string[];
  /** Top-level declaration names across the scanned sources. */
  symbols: string[];
}

export interface ContextRotOptions {
  rules?: string[];
}

export type ContextRotFinding = Omit<Diagnostic, 'filePath' | 'ruleId'>;

export interface ContextRotContext {
  content: string;
  filePath: string;
  facts: RepoFacts;
  locator: TextLocator;
}

export interface TextLocator {
  getLineAndCharacterOfPosition(pos: number): { line: number; character: number };
}

export type ContextRotRuleFn = (context: ContextRotContext) => ContextRotFinding[];

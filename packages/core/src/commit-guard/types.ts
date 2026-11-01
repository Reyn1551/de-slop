import type { Diagnostic } from '../slop-scanner/types';

export type { Diagnostic };

export interface CommitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Every top-level declaration in the file after the change. */
  symbols?: string[];
  /** Declaration names present after the change that were absent before. */
  addedSymbols?: string[];
  /** Declaration names present before the change that are absent after. */
  removedSymbols?: string[];
}

export interface CommitDiff {
  files: CommitFile[];
}

export interface CommitGuardOptions {
  rules?: string[];
}

export type CommitFinding = Omit<Diagnostic, 'filePath' | 'ruleId'>;

export interface CommitContext {
  /** First line of the message. */
  subject: string;
  /** Everything after the subject, untrimmed. */
  body: string;
  message: string;
  diff: CommitDiff;
  /** Paths in the diff, for messages that name a file. */
  touched: Set<string>;
  /** Every symbol any file in the diff added. */
  addedSymbols: Set<string>;
  /** Every symbol any file in the diff removed. */
  removedSymbols: Set<string>;
  /** Every symbol that existed before and after. */
  survivingSymbols: Set<string>;
}

export type CommitRuleFn = (context: CommitContext) => CommitFinding[];

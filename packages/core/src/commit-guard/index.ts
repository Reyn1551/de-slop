import type { Diagnostic } from '../slop-scanner/types';
import { noGenericSubject, noOversizedSubject, noPhantomAddition, noPhantomPath, noPhantomRemoval, noSlopMessageBody, noTestClaimWithoutTest, noUnmentionedScope } from './rules';
import type { CommitContext, CommitDiff, CommitFinding, CommitGuardOptions, CommitRuleFn } from './types';

export type { CommitDiff, CommitFile, CommitGuardOptions } from './types';
export { collectTopLevelSymbols, addedSymbols, removedSymbols, isSourcePath } from '../symbols';

export const COMMIT_RULES = {
  'no-phantom-path': noPhantomPath,
  'no-phantom-addition': noPhantomAddition,
  'no-phantom-removal': noPhantomRemoval,
  'no-test-claim-without-test': noTestClaimWithoutTest,
  'no-generic-subject': noGenericSubject,
  'no-oversized-subject': noOversizedSubject,
  'no-unmentioned-scope': noUnmentionedScope,
  'no-slop-message-body': noSlopMessageBody,
} as const;

export type CommitRuleId = keyof typeof COMMIT_RULES;

export const COMMIT_RULE_IDS = Object.keys(COMMIT_RULES) as CommitRuleId[];

function splitMessage(message: string): { subject: string; body: string } {
  const trimmed = message.replace(/\r\n/g, '\n');
  const newline = trimmed.indexOf('\n');
  if (newline === -1) return { subject: trimmed.trim(), body: '' };
  return { subject: trimmed.slice(0, newline).trim(), body: trimmed.slice(newline + 1) };
}

function buildContext(message: string, diff: CommitDiff): CommitContext {
  const { subject, body } = splitMessage(message);
  const touched = new Set<string>();
  const added = new Set<string>();
  const removed = new Set<string>();
  const surviving = new Set<string>();

  for (const file of diff.files) {
    touched.add(file.path);
    for (const symbol of file.addedSymbols ?? []) added.add(symbol);
    for (const symbol of file.removedSymbols ?? []) removed.add(symbol);
  }

  // "Surviving" is what a reviewer would still find after the change: every
  // declaration the files report, minus the ones the change removed. Symbols
  // that appear in both added and removed were renamed or re-declared, so they
  // survive too.
  for (const file of diff.files) {
    for (const symbol of file.symbols ?? []) {
      if (!removed.has(symbol)) surviving.add(symbol);
    }
  }
  for (const symbol of added) {
    if (removed.has(symbol)) surviving.add(symbol);
  }

  return { subject, body, message, diff, touched, addedSymbols: added, removedSymbols: removed, survivingSymbols: surviving };
}

/**
 * Check a commit message against the diff it describes.
 *
 * The messages that matter are the specific ones: a commit that names a file or
 * a symbol and is wrong costs a reviewer a trip through the diff. A vague
 * message is a warning, never an error.
 */
export function analyzeCommitMessage(
  message: string,
  diff: CommitDiff,
  options: CommitGuardOptions = {},
): Diagnostic[] {
  if (message.trim().length === 0) {
    return [{
      ruleId: 'commit-empty-message',
      severity: 'error',
      message: 'Commit message is empty — nothing tells a reviewer what changed or why',
      filePath: 'COMMIT_EDITMSG',
      line: 1,
      column: 1,
    }];
  }

  const context = buildContext(message, diff);
  const enabled = options.rules
    ? options.rules.filter((id): id is CommitRuleId => id in COMMIT_RULES)
    : COMMIT_RULE_IDS;

  const diagnostics: Diagnostic[] = [];
  for (const ruleId of enabled) {
    const rule: CommitRuleFn = COMMIT_RULES[ruleId];
    for (const finding of rule(context)) {
      diagnostics.push({ ...finding, ruleId, filePath: 'COMMIT_EDITMSG' });
    }
  }
  return diagnostics;
}

export type { CommitFinding, CommitRuleFn };

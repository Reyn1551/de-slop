import type { CommitContext, CommitFinding, CommitRuleFn } from './types';

// Gong, Pinna, Bian, and Zhang, "Analyzing Message-Code Inconsistency in AI
// Coding Agent-Authored Pull Requests" (arXiv:2601.04886): across 23,247 agentic
// PRs, 1.7% carried high message-code inconsistency, and those PRs had a 51.7%
// lower acceptance rate and took 3.5x longer to merge. The most common type,
// 45.4% of the sample, claimed changes the diff never made.
//
// So the valuable check is narrow: when a message names a specific thing, does
// the diff contain that thing. Vague messages are not errors, but a specific
// claim the code contradicts is.

const BACKTICKED = /`([^`\n]{2,80})`/g;
const PATH_SHAPE = /(?:^|\/)[\w.-]+\.[a-z]{1,4}$/;
const SYMBOL_SHAPE = /^[A-Za-z_$][\w$]*$/;

// A path only counts when it carries a directory and an extension, so a bare
// `README.md` referenced in prose is not treated as a claim about the diff.
const BARE_PATH = /(?<![`\w/.-])((?:[\w.-]+\/)+[\w.-]+\.[a-z]{1,4})(?![`\w.-])/g;

function namedPaths(context: CommitContext): { value: string; index: number }[] {
  const found: { value: string; index: number }[] = [];
  const seen = new Set<string>();

  for (const match of context.message.matchAll(BACKTICKED)) {
    const value = match[1].trim();
    if (!PATH_SHAPE.test(value) || !value.includes('/')) continue;
    const normalized = value.replace(/^\.\//, '');
    seen.add(normalized);
    found.push({ value: normalized, index: match.index ?? 0 });
  }

  // Paths are also written without backticks. Skipping them let a message name
  // a file the diff never touched and pass.
  for (const match of context.message.matchAll(BARE_PATH)) {
    const value = match[1].replace(/^\.\//, '');
    if (seen.has(value)) continue;
    if (value.startsWith('http')) continue;
    seen.add(value);
    found.push({ value, index: match.index ?? 0 });
  }

  return found;
}

function namedSymbols(context: CommitContext): { value: string; index: number }[] {
  const found: { value: string; index: number }[] = [];
  for (const match of context.message.matchAll(BACKTICKED)) {
    const value = match[1].trim().replace(/\(\)$/, '');
    if (!SYMBOL_SHAPE.test(value)) continue;
    found.push({ value, index: match.index ?? 0 });
  }
  return found;
}

function position(context: CommitContext, index: number): { line: number; column: number } {
  const prefix = context.message.slice(0, index);
  const lines = prefix.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/** A path in the message that the diff never touched. */
export const noPhantomPath: CommitRuleFn = (context) => {
  const findings: CommitFinding[] = [];

  for (const { value, index } of namedPaths(context)) {
    if (context.touched.has(value)) continue;
    const suffixMatch = [...context.touched].some((touched) => touched.endsWith(`/${value}`));
    if (suffixMatch) continue;

    findings.push({
      severity: 'error',
      message: `Message names \`${value}\` but no file of that path is in the diff — a claim the code contradicts is the most common message-code inconsistency (arXiv:2601.04886)`,
      ...position(context, index),
    });
  }

  return findings;
};

/** A symbol the message says was added, which no file added. */
export const noPhantomAddition: CommitRuleFn = (context) => {
  const findings: CommitFinding[] = [];

  for (const { value, index } of namedSymbols(context)) {
    if (context.addedSymbols.has(value)) continue;
    if (context.survivingSymbols.has(value)) continue;

    const claimsAddition = new RegExp(
      `\\b(?:add|adds|added|introduce|introduces|introduced|create|creates|created|implement|implements|implemented)\\b[^.!?\\n]{0,60}\`${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i',
    ).test(context.message);
    if (!claimsAddition) continue;

    const elsewhere = context.removedSymbols.has(value);
    findings.push({
      severity: 'error',
      message: elsewhere
        ? `Message says \`${value}\` was added, but the diff removes it`
        : `Message says \`${value}\` was added, and no file in the diff declares it — reviewers find this out by reading the code`,
      ...position(context, index),
    });
  }

  return findings;
};

/** A symbol the message says was removed, which the diff keeps. */
export const noPhantomRemoval: CommitRuleFn = (context) => {
  const findings: CommitFinding[] = [];

  for (const { value, index } of namedSymbols(context)) {
    if (context.removedSymbols.has(value)) continue;
    if (!context.survivingSymbols.has(value)) continue;

    const claimsRemoval = new RegExp(
      `\\b(?:remove|removes|removed|delete|deletes|deleted|drop|drops|dropped|eliminate|eliminates|eliminated)\\b[^.!?\\n]{0,60}\`${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i',
    ).test(context.message);
    if (!claimsRemoval) continue;

    findings.push({
      severity: 'error',
      message: `Message says \`${value}\` was removed, but it is still declared after the change`,
      ...position(context, index),
    });
  }

  return findings;
};

const TEST_FILE = /(?:^|\/)(?:__tests__|tests?|spec)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const DOC_FILE = /\.(?:md|mdx|markdown|rst|adoc|txt)$/i;

/** A commit that claims tests but ships none. */
export const noTestClaimWithoutTest: CommitRuleFn = (context) => {
  if (!/\btests?\b|\btesting\b|\bcoverage\b|\bregressions?\b/i.test(context.message)) return [];
  if (context.diff.files.some((file) => TEST_FILE.test(file.path))) return [];

  return [{
    severity: 'error',
    message: 'Message mentions tests, but the diff touches no test file — a false green starts with a claim nobody checks',
    line: 1,
    column: 1,
  }];
};

/** A commit that claims documentation but ships none. */
export const noDocsClaimWithoutDocs: CommitRuleFn = (context) => {
  if (!/\bdocs?\b|\bdocumentation\b|\breadme\b|\bchangelog\b/i.test(context.message)) return [];
  if (context.diff.files.some((file) => DOC_FILE.test(file.path))) return [];

  return [{
    severity: 'warning',
    message: 'Message mentions documentation, but the diff touches no document',
    line: 1,
    column: 1,
  }];
};

const GENERIC_SUBJECT = [
  /^(?:update|updates|updated)\s+(?:code|files?|stuff|things)$/i,
  /^(?:fix|fixes|fixed)\s+(?:bug|bugs|issue|issues|things?)$/i,
  /^(?:improve|improves|improved)\s+(?:code|quality|performance|things?)$/i,
  /^(?:various|misc|miscellaneous)\s+(?:changes|updates|fixes|improvements)$/i,
  /^(?:wip|work in progress|tmp|temp)$/i,
  /^(?:refactor|cleanup|clean up)$/i,
];

/** A subject that says nothing a reviewer could use. */
export const noGenericSubject: CommitRuleFn = (context) => {
  if (!GENERIC_SUBJECT.some((pattern) => pattern.test(context.subject.trim()))) return [];

  return [{
    severity: 'warning',
    message: `Subject "${context.subject.trim()}" names no change — say what moved and where, or the reviewer has to diff it themselves`,
    line: 1,
    column: 1,
  }];
};

const MAX_SUBJECT = 72;

/** A subject longer than the width git log and every review UI assume. */
export const noOversizedSubject: CommitRuleFn = (context) => {
  if (context.subject.length <= MAX_SUBJECT) return [];

  return [{
    severity: 'warning',
    message: `Subject is ${context.subject.length} characters (limit ${MAX_SUBJECT}) — it wraps in git log and the PR title bar`,
    line: 1,
    column: MAX_SUBJECT + 1,
  }];
};

const UNMENTIONED_THRESHOLD = 5;

/** A large diff whose message names none of it. */
export const noUnmentionedScope: CommitRuleFn = (context) => {
  const files = context.diff.files;
  if (files.length <= UNMENTIONED_THRESHOLD) return [];

  const named = files.filter((file) => context.message.includes(file.path) || context.message.includes(file.path.split('/').pop() ?? ''));
  if (named.length > 0) return [];

  return [{
    severity: 'warning',
    message: `${files.length} files changed and the message names none of them — describe the shape of the change, or a reviewer cannot tell what to look at`,
    line: 1,
    column: 1,
  }];
};

/** The message body reports an intention instead of a change. */
export const noSlopMessageBody: CommitRuleFn = (context) => {
  if (context.body.trim().length === 0) return [];
  return findGenericBody(context);
};

const BODY_CLICHES = [
  /\bthis\s+(?:commit|change|pr|pull request)\s+(?:improves|enhances|updates|refactors)\b[^.\n]{0,60}\bto\s+(?:be|make|ensure)\b/i,
  /\b(?:as\s+requested|per\s+your\s+request|as\s+discussed)\b/i,
  /\b(?:no\s+functional\s+changes?|no\s+behavior(?:al)?\s+changes?)\b/i,
  /\b(?:various|multiple|several)\s+(?:improvements|enhancements|updates|fixes)\b/i,
  /\bensure[sd]?\s+(?:that\s+)?(?:the\s+)?(?:code|system|application)\s+(?:remains|stays|is)\s+(?:robust|clean|maintainable|reliable)\b/i,
];

function findGenericBody(context: CommitContext): CommitFinding[] {
  const findings: CommitFinding[] = [];
  for (const pattern of BODY_CLICHES) {
    const match = pattern.exec(context.body);
    if (match === null) continue;
    const offset = context.subject.length + 1 + (match.index ?? 0);
    findings.push({
      severity: 'warning',
      message: `Body line "${match[0].slice(0, 60)}" reports an intention rather than a change — name the file, symbol, or behavior that moved`,
      ...position(context, offset),
    });
  }
  return findings;
}

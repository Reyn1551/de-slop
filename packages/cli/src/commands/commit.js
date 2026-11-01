import { analyzeCommitMessage } from '@de-slop/core';
import { parseArgs } from '../args.js';
import { readMessage, stagedDiff } from '../git-diff.js';

export const help = `de-slop commit — check a commit message against its diff

Usage: de-slop commit [message-file] [options]

Compares the message with the staged change set: a file or symbol the message
names, which the diff never touched, is an error. Across 23,247 agentic pull
requests, high message-code inconsistency correlated with a 51.7% lower
acceptance rate and 3.5 times longer merge time (arXiv:2601.04886).

Pass a path to check a file (git's COMMIT_EDITMSG is the usual one). With no
path the message is read from the first argument or from stdin is skipped.

Options:
  --message <text>  Check this message instead of a file
  --staged          Build the diff from the index (default)
  --json            Print machine-readable JSON
  --help            Show this help

Exit code is 1 when a claim contradicts the diff.
`;

const COMMENT = /^\s*#/;

/** Strip the commented template git leaves in COMMIT_EDITMSG. */
function cleanMessage(raw) {
  return raw
    .split('\n')
    .filter((line) => !COMMENT.test(line))
    .join('\n')
    .trim();
}

export default async function commit(argv) {
  const { positional, options } = parseArgs(argv);
  const messagePath = typeof positional[0] === 'string' ? positional[0] : '.git/COMMIT_EDITMSG';

  let message;
  if (typeof options.message === 'string') {
    message = options.message;
  } else {
    const raw = readMessage(messagePath);
    if (raw === null) {
      console.error(`de-slop commit: cannot read message file ${messagePath}`);
      return 1;
    }
    message = cleanMessage(raw);
  }

  const diff = stagedDiff(process.cwd());
  const diagnostics = analyzeCommitMessage(message, diff);
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;

  if (options.json) {
    console.log(JSON.stringify({ message, files: diff.files.map((file) => file.path), diagnostics }, null, 2));
    return errors > 0 ? 1 : 0;
  }

  for (const diagnostic of diagnostics) {
    console.log(
      `${diagnostic.filePath}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.message}`,
    );
  }
  console.log(`${diff.files.length} files in the diff, ${errors} errors, ${warnings} warnings`);
  return errors > 0 ? 1 : 0;
}

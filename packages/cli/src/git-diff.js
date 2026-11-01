import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { addedSymbols, collectTopLevelSymbols, removedSymbols } from '@de-slop/core/symbols';

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/**
 * Read a file as git has it, either staged (`:path`) or at HEAD.
 * Returns undefined when the revision does not have the file.
 */
function gitFile(revision, cwd) {
  return git(['show', revision], cwd) ?? undefined;
}

/**
 * Build the diff a commit is about: the staged change set, plus the symbols each
 * file gained or lost. Symbol work reads the before-image from HEAD and the
 * after-image from the index, so an unstaged edit on disk cannot confuse it.
 */
export function stagedDiff(cwd = process.cwd()) {
  const status = git(['diff', '--cached', '--name-status'], cwd);
  if (status === null) return { files: [] };

  const files = [];
  for (const line of status.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const [code, first, second] = trimmed.split('\t');
    if (code === undefined || first === undefined) continue;

    if (code.startsWith('R')) {
      files.push({ path: second ?? first, status: 'renamed' });
      continue;
    }

    const statusName = code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified';
    const path = first;
    const before = statusName === 'added' ? undefined : gitFile(`HEAD:${path}`, cwd);
    const after = statusName === 'deleted' ? undefined : gitFile(`:${path}`, cwd);

    const entry = { path, status: statusName };
    if (after !== undefined) {
      entry.symbols = collectTopLevelSymbols(after, path);
      if (before !== undefined) entry.addedSymbols = addedSymbols(before, after, path);
      else entry.addedSymbols = entry.symbols;
    }
    if (before !== undefined) {
      entry.removedSymbols = after === undefined
        ? collectTopLevelSymbols(before, path)
        : removedSymbols(before, after, path);
    }
    files.push(entry);
  }

  return { files };
}

/** Read a commit message file, falling back to nothing when it is absent. */
export function readMessage(messagePath) {
  try {
    return readFileSync(messagePath, 'utf8');
  } catch {
    return null;
  }
}

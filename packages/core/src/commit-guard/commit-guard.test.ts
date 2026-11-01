import { describe, expect, it } from 'vitest';
import { analyzeCommitMessage, COMMIT_RULE_IDS } from './index';
import type { CommitDiff } from './types';

function diff(files: CommitDiff['files']): CommitDiff {
  return { files };
}

const SIMPLE = diff([
  { path: 'src/token.ts', status: 'added', symbols: ['createToken'], addedSymbols: ['createToken'] },
  {
    path: 'src/auth.ts',
    status: 'modified',
    symbols: ['signIn', 'logout'],
    addedSymbols: ['signIn'],
    removedSymbols: ['login'],
  },
]);

function ruleIds(message: string, files: CommitDiff = SIMPLE): string[] {
  return analyzeCommitMessage(message, files).map((diagnostic) => diagnostic.ruleId);
}

describe('commit-guard', () => {
  it('exposes 8 rules', () => {
    expect(COMMIT_RULE_IDS).toHaveLength(8);
  });

  it('flags an empty message', () => {
    const diagnostics = analyzeCommitMessage('', SIMPLE);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].ruleId).toBe('commit-empty-message');
  });

  it('accepts a message that matches the diff', () => {
    expect(ruleIds('feat(auth): add createToken and signIn\n\nThe token helper lives in `src/token.ts`.\n')).toEqual([]);
  });

  it('flags a path the diff never touched', () => {
    expect(ruleIds('fix(auth): adjust `src/legacy/session.ts`\n')).toContain('no-phantom-path');
  });

  it('accepts a path present in the diff', () => {
    expect(ruleIds('fix(auth): adjust `src/auth.ts`\n')).not.toContain('no-phantom-path');
  });

  it('flags a symbol claimed as added but absent', () => {
    expect(ruleIds('feat: add `refreshToken`\n')).toContain('no-phantom-addition');
  });

  it('accepts a symbol the diff added', () => {
    expect(ruleIds('feat: add `createToken`\n')).not.toContain('no-phantom-addition');
  });

  it('flags a symbol claimed as removed but still present', () => {
    expect(ruleIds('refactor: remove `logout`\n')).toContain('no-phantom-removal');
  });

  it('accepts a symbol the diff removed', () => {
    expect(ruleIds('refactor: remove `login`\n')).not.toContain('no-phantom-removal');
  });

  it('accepts a removal claim with no symbol at all', () => {
    expect(ruleIds('refactor: remove the unused retry guard\n')).not.toContain('no-phantom-removal');
  });

  it('flags a test claim with no test file', () => {
    expect(ruleIds('feat: add coverage for the token helper\n')).toContain('no-test-claim-without-test');
  });

  it('accepts a test claim with a test file', () => {
    const withTest = diff([...SIMPLE.files, { path: 'src/token.test.ts', status: 'added' }]);
    expect(ruleIds('feat: add coverage for the token helper\n', withTest)).not.toContain('no-test-claim-without-test');
  });

  it('flags a generic subject', () => {
    expect(ruleIds('update code\n')).toContain('no-generic-subject');
    expect(ruleIds('fix bugs\n')).toContain('no-generic-subject');
    expect(ruleIds('various changes\n')).toContain('no-generic-subject');
  });

  it('accepts a specific subject', () => {
    expect(ruleIds('feat(auth): add createToken\n')).not.toContain('no-generic-subject');
  });

  it('flags an oversized subject', () => {
    const subject = `feat: ${'x'.repeat(90)}`;
    expect(ruleIds(`${subject}\n`)).toContain('no-oversized-subject');
  });

  it('flags a large diff whose message names nothing', () => {
    const many = diff(
      Array.from({ length: 8 }, (_, index) => ({ path: `src/file-${index}.ts`, status: 'modified' as const })),
    );
    expect(ruleIds('chore: tidy\n', many)).toContain('no-unmentioned-scope');
  });

  it('accepts a large diff that names a file', () => {
    const many = diff(
      Array.from({ length: 8 }, (_, index) => ({ path: `src/file-${index}.ts`, status: 'modified' as const })),
    );
    expect(ruleIds('chore: tidy `src/file-3.ts`\n', many)).not.toContain('no-unmentioned-scope');
  });

  it('does not flag unmentioned scope for a small diff', () => {
    expect(ruleIds('chore: tidy\n')).not.toContain('no-unmentioned-scope');
  });

  it('flags a body that reports an intention', () => {
    const message = 'feat: add createToken\n\nThis commit improves the codebase to be more maintainable.\n';
    expect(ruleIds(message)).toContain('no-slop-message-body');
  });

  it('accepts a body that names the change', () => {
    const message = 'feat: add createToken\n\nTokens expire after one hour. `signIn` now calls it.\n';
    expect(ruleIds(message)).not.toContain('no-slop-message-body');
  });

  it('reports positions inside the message', () => {
    const message = 'feat: add `refreshToken`\n\nBody text here.\n';
    for (const diagnostic of analyzeCommitMessage(message, SIMPLE)) {
      expect(diagnostic.line).toBeGreaterThanOrEqual(1);
      expect(diagnostic.column).toBeGreaterThanOrEqual(1);
    }
  });

  it('stamps every diagnostic with the message path', () => {
    const message = 'update code and `src/missing.ts`\n';
    for (const diagnostic of analyzeCommitMessage(message, SIMPLE)) {
      expect(diagnostic.filePath).toBe('COMMIT_EDITMSG');
    }
  });

  it('honours the rules filter', () => {
    const message = 'update code and `src/missing.ts`\n';
    const diagnostics = analyzeCommitMessage(message, SIMPLE, { rules: ['no-generic-subject'] });
    expect(diagnostics.every((diagnostic) => diagnostic.ruleId === 'no-generic-subject')).toBe(true);
  });

  it('treats severity as an error only for a contradicted claim', () => {
    const diagnostics = analyzeCommitMessage('feat: add `refreshToken`\n', SIMPLE);
    const phantom = diagnostics.find((diagnostic) => diagnostic.ruleId === 'no-phantom-addition');
    expect(phantom?.severity).toBe('error');
    expect(diagnostics.find((diagnostic) => diagnostic.ruleId === 'no-oversized-subject')).toBeUndefined();
  });
});

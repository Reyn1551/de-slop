import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = resolve(__dirname, '..', '..');
const bin = join(root, 'packages/cli/bin/de-slop.js');
const fixtures = join(root, 'tests/fixtures');

function runCli(args: string[], opts: { cwd?: string; input?: string } = {}): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('node', [bin, ...args], {
      cwd: opts.cwd ?? root,
      input: opts.input,
      encoding: 'utf8',
      timeout: 30000,
    });
    return { stdout, status: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? '', status: err.status ?? 1 };
  }
}

describe('cli e2e', () => {
  it('reports findings on slop fixture and exits 1 on errors', () => {
    const { stdout, status } = runCli(['check', join(fixtures, 'slop-fixture.ts')]);
    expect(status).toBe(1);
    expect(stdout).toContain('no-hardcoded-secret');
    expect(stdout).toContain('no-unused-var');
    expect(stdout).toContain('no-empty-catch');
  });

  it('passes clean fixture', () => {
    const { stdout, status } = runCli(['check', join(fixtures, 'clean-fixture.ts')]);
    expect(status).toBe(0);
    expect(stdout).toContain('0 problems found');
  });

  it('supports --rules filtering', () => {
    const { stdout } = runCli(['check', join(fixtures, 'slop-fixture.ts'), '--rules', 'no-unused-var']);
    expect(stdout).toContain('no-unused-var');
    expect(stdout).not.toContain('no-hardcoded-secret');
  });

  it('fix removes redundant comment and unused var', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-e2e-'));
    const file = join(dir, 'fixme.ts');
    writeFileSync(file, '// increment i by 1\ni++;\nlet unused = 1;\n');
    const { stdout, status } = runCli(['fix', file]);
    expect(status).toBe(0);
    expect(stdout).toContain('fixed');
    const fixed = readFileSync(file, 'utf8');
    expect(fixed).not.toContain('increment i by 1');
    expect(fixed).not.toContain('unused');
    rmSync(dir, { recursive: true, force: true });
  });

  it('init writes config and pre-commit hook', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-init-'));
    execFileSync('git', ['init', '-q', dir], { cwd: dir });
    execFileSync('git', ['config', 'user.email', 't@t.io'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
    writeFileSync(join(dir, 'package.json'), '{"name":"t","version":"0.0.0"}');
    const { stdout, status } = runCli(['init'], { cwd: dir });
    expect(status).toBe(0);
    expect(existsSync(join(dir, '.desloprc.json'))).toBe(true);
    expect(existsSync(join(dir, '.git/hooks/pre-commit'))).toBe(true);
    expect(stdout).toContain('de-slop');
    rmSync(dir, { recursive: true, force: true });
  });

  it('verify tests against lock detects weakening', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-lock-'));
    const testFile = join(dir, 'locked.test.ts');
    const original = readFileSync(join(fixtures, 'test-lock/locked.fixture.ts'), 'utf8');
    writeFileSync(testFile, original);

    const { lockTestFile, verifyTestFile } = await import('@de-slop/core/test-lock');
    await lockTestFile(testFile);

    const weakened = original.replace('expect(count).toBe(1)', 'expect(count).toBe(2)');
    writeFileSync(testFile, weakened);
    const violations = await verifyTestFile(testFile);
    expect(violations.some((v: any) => v.type === 'assertion-weakened' || v.type === 'assertion-removed')).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

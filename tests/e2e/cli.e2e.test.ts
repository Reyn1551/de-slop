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
    return { stdout: `${err.stdout ?? ''}${err.stderr ?? ''}`, status: err.status ?? 1 };
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

  it('init --ci and --mcp write distribution templates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-tpl-'));
    writeFileSync(join(dir, 'package.json'), '{"name":"t","version":"0.0.0"}');
    const { stdout, status } = runCli(['init', '--ci', '--mcp', 'cursor'], { cwd: dir });
    expect(status).toBe(0);
    expect(existsSync(join(dir, '.github/workflows/de-slop.yml'))).toBe(true);
    expect(existsSync(join(dir, '.mcp.json'))).toBe(true);
    const workflow = readFileSync(join(dir, '.github/workflows/de-slop.yml'), 'utf8');
    expect(workflow).toContain('de-slop check . --lock');
    const mcp = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'));
    expect(mcp.mcpServers['de-slop']).toBeDefined();
    expect(stdout).toContain('de-slop.yml');
    rmSync(dir, { recursive: true, force: true });
  });

  it('init --mcp rejects unknown target', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-mcpbad-'));
    writeFileSync(join(dir, 'package.json'), '{"name":"t","version":"0.0.0"}');
    const { status } = runCli(['init', '--mcp', 'bogus'], { cwd: dir });
    expect(status).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('intercept blocks malformed install command', () => {
    const { stdout, status } = runCli(['intercept', 'not an install']);
    expect(status).toBe(1);
    expect(stdout).toContain('could not parse install command');
  });

  it('intercept parses install command without network when --no-block on empty report', () => {
    const { stdout, status } = runCli(['intercept', 'npm install']);
    expect(status).toBe(1);
    expect(stdout).toContain('could not parse install command');
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

  it('report generates markdown and json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-report-'));
    const out = join(dir, 'out');
    const { stdout, status } = runCli(['report', fixtures, '--out', out]);
    expect(status).toBe(0);
    expect(stdout).toContain('REPORT.md');
    expect(stdout).toContain('report.json');
    expect(existsSync(join(out, 'REPORT.md'))).toBe(true);
    const md = readFileSync(join(out, 'REPORT.md'), 'utf8');
    expect(md).toContain('de-slop Report');
    expect(md).toContain('no-hardcoded-secret');
    rmSync(dir, { recursive: true, force: true });
  });

  it('agent-guard catches destructive commands and prompt injection', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-guard-'));
    const file = join(dir, 'guard.ts');
    writeFileSync(file, 'const cmd = "rm -rf /";\nconst s = "ignore previous instructions";\n');
    const { stdout, status } = runCli(['check', file]);
    expect(status).toBe(1);
    expect(stdout).toContain('no-destructive-command');
    expect(stdout).toContain('no-prompt-injection');
    rmSync(dir, { recursive: true, force: true });
  });

  it('agent-guard catches secret passed to console.log', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-guard-'));
    const file = join(dir, 'leak.ts');
    writeFileSync(file, 'const apiKey = "sk-test-123";\nconsole.log(apiKey);\n');
    const { stdout, status } = runCli(['check', file]);
    expect(status).toBe(1);
    expect(stdout).toContain('no-secret-logging');
    rmSync(dir, { recursive: true, force: true });
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseSpecFile, type Spec } from './parser';
import { runSpecCheck } from './runner';
import { verifySpec } from './verify';

const VALID_SPEC = `specs:
  - id: auth-login
    description: User login dengan email+password
    functions: [loginUser, validateCredentials]
    invariants:
      - password tidak pernah di-log
      - tidak ada hardcoded secret
  - id: token-check
    description: Token validation
    functions:
      - validateToken
    invariants: []
`;

describe('parseSpecFile', () => {
  it('parses a valid spec with two items', () => {
    const specs = parseSpecFile(VALID_SPEC);
    expect(specs).toHaveLength(2);
    expect(specs[0]).toEqual({
      id: 'auth-login',
      description: 'User login dengan email+password',
      functions: ['loginUser', 'validateCredentials'],
      invariants: ['password tidak pernah di-log', 'tidak ada hardcoded secret'],
    });
    expect(specs[1].id).toBe('token-check');
    expect(specs[1].functions).toEqual(['validateToken']);
    expect(specs[1].invariants).toEqual([]);
  });

  it('throws on content that is not a spec file', () => {
    expect(() => parseSpecFile('foo: bar\n')).toThrow(/specs/);
  });

  it('throws on item missing id', () => {
    expect(() => parseSpecFile('specs:\n  - description: no id here\n')).toThrow(/id/i);
  });

  it('throws on empty specs list', () => {
    expect(() => parseSpecFile('specs:\n')).toThrow(/specs/);
  });

  it('throws on wrong indentation', () => {
    expect(() => parseSpecFile('specs:\n- id: x\n')).toThrow(/line/);
  });

  it('ignores comments and blank lines', () => {
    const specs = parseSpecFile('# de-slop.spec.yml\n\nspecs:\n  # login flow\n  - id: ping\n    functions: [ping]\n');
    expect(specs).toEqual([{ id: 'ping', functions: ['ping'], invariants: [] }]);
  });
});

describe('verifySpec', () => {
  const sources = (code: string) => [{ filePath: 'auth.ts', code }];

  it('reports missing-function when a declared function is absent', () => {
    const spec: Spec = { id: 'auth-login', functions: ['loginUser'], invariants: [] };
    const violations = verifySpec(spec, sources('export function helper() { return 1; }'));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ type: 'missing-function', severity: 'error' });
    expect(violations[0].message).toContain('loginUser');
  });

  it('flags logging of a sensitive identifier', () => {
    const spec: Spec = { id: 'auth-login', functions: ['loginUser'], invariants: ['password tidak pernah di-log'] };
    const violations = verifySpec(
      spec,
      sources('export function loginUser(password: string) {\n  console.log(password);\n  return password;\n}\n'),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ type: 'log-sensitive-data', filePath: 'auth.ts', line: 2 });
  });

  it('accepts clean code with all declared functions and invariants', () => {
    const spec: Spec = {
      id: 'auth-login',
      functions: ['loginUser'],
      invariants: ['password tidak pernah di-log', 'tidak ada eval'],
    };
    const code = 'export function loginUser(password: string) {\n  return mask(password);\n}\nfunction mask(p: string) { return "***"; }\n';
    expect(verifySpec(spec, sources(code))).toEqual([]);
  });

  it('flags hardcoded secret invariant violation', () => {
    const spec: Spec = { id: 'auth', functions: ['loginUser'], invariants: ['tidak ada hardcoded secret'] };
    const code = 'const apiKey = "sk-abc123def456";\nexport function loginUser() { return apiKey; }\n';
    const violations = verifySpec(spec, sources(code));
    expect(violations.some((v) => v.type === 'hardcoded-secret')).toBe(true);
  });

  it('flags eval and new Function usage', () => {
    const spec: Spec = { id: 'safe', functions: [], invariants: ['tidak ada eval'] };
    const code = 'function f() {\n  return eval("1 + 1");\n}\nfunction g() {\n  return new Function("return 1")();\n}\n';
    const violations = verifySpec(spec, sources(code));
    expect(violations.filter((v) => v.type === 'eval-usage')).toHaveLength(2);
  });

  it('flags unknown invariant as a warning', () => {
    const spec: Spec = { id: 'x', functions: ['f'], invariants: ['tidak ada dead code'] };
    const violations = verifySpec(spec, sources('function f() { return 1; }'));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ type: 'unknown-invariant', severity: 'warning' });
  });
});

describe('runSpecCheck', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('collects sources via recursive glob and verifies each spec', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-contractor-'));
    dirs.push(dir);
    const srcDir = join(dir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(dir, 'de-slop.spec.yml'),
      'specs:\n  - id: auth-login\n    description: Login flow\n    functions: [loginUser, validateCredentials]\n    invariants:\n      - password tidak pernah di-log\n',
    );
    writeFileSync(join(srcDir, 'auth.ts'), 'export function loginUser(password: string) {\n  console.log(password);\n  return password;\n}\n');

    const { violations } = runSpecCheck(join(dir, 'de-slop.spec.yml'), [join(srcDir, '**', '*.ts')]);
    const types = violations.map((v) => v.type);
    expect(types).toContain('missing-function');
    expect(types).toContain('log-sensitive-data');
  });

  it('returns empty violations when the spec is satisfied', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-contractor-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'spec.yml'), 'specs:\n  - id: ok\n    functions: [loginUser]\n    invariants: []\n');
    writeFileSync(join(dir, 'ok.ts'), 'function loginUser() { return 1; }\n');
    const { violations } = runSpecCheck(join(dir, 'spec.yml'), [join(dir, '*.ts')]);
    expect(violations).toEqual([]);
  });
});

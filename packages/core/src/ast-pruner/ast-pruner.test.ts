import { describe, expect, it } from 'vitest';
import { pruneFiles, pruneSource } from './pruner';

const IMPORTED = `import { helper } from './util';
import { unusedHelper } from './other';
export function getUserById(id: string): string {
  return helper(id);
}
function validateCredentials(p: string): boolean {
  return p.length > 0;
}
`;

describe('pruneSource', () => {
  it('keeps only declarations matching the query plus their imports', () => {
    const out = pruneSource(IMPORTED, 'auth.ts', ['user']);
    expect(out).toContain('getUserById');
    expect(out).toContain("import { helper } from './util'");
    expect(out).not.toContain('validateCredentials');
    expect(out).not.toContain('unusedHelper');
  });

  it('matches camelCase segments', () => {
    const code = 'export function getUserById(id: string): string { return id; }\nexport function sendEmail(): void {}\n';
    const out = pruneSource(code, 'u.ts', ['user']);
    expect(out).toContain('getUserById');
    expect(out).not.toContain('sendEmail');
  });

  it('returns a declaration summary when nothing matches', () => {
    const code =
      'export function loginUser(p: string): string { return p; }\n' +
      'class Auth { login() { return 1; } }\n' +
      'interface User { id: string }\n' +
      'type UserId = string;\n' +
      'export const API_KEY = "sk-abc123def456";\n';
    const out = pruneSource(code, 's.ts', ['zebra']);
    expect(out).toContain('function: loginUser');
    expect(out).toContain('class: Auth');
    expect(out).toContain('interface: User');
    expect(out).toContain('type: UserId');
    expect(out).toContain('const: API_KEY');
    expect(out).not.toContain('export function loginUser');
  });

  it('returns empty string when the file has no top-level declarations', () => {
    expect(pruneSource('const x = 1;\nconsole.log(x);\n', 'x.ts', ['user'])).toBe('');
  });
});

describe('pruneFiles', () => {
  it('drops files without matches', () => {
    const files = [
      { filePath: 'a.ts', code: 'export function findUser() { return 1; }\n' },
      { filePath: 'b.ts', code: 'const x = 1;\nconsole.log(x);\n' },
    ];
    const out = pruneFiles(files, ['user']);
    expect(out.map((f) => f.filePath)).toEqual(['a.ts']);
    expect(out[0].content).toContain('findUser');
  });
});

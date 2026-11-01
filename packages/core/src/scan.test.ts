import { describe, expect, it } from 'vitest';
import { scanContent } from './scan';

describe('scanContent', () => {
  it('runs the AST rules for code files', () => {
    const code = 'const apiKey = "sk-live-abcdef";\n';
    const ids = scanContent(code, 'src/config.ts').map((diagnostic) => diagnostic.ruleId);
    expect(ids).toContain('no-hardcoded-secret');
  });

  it('runs the runtime guards for code files', () => {
    const code = 'async function load() {}\nload();\n';
    const ids = scanContent(code, 'src/load.ts').map((diagnostic) => diagnostic.ruleId);
    expect(ids).toContain('no-floating-promise');
  });

  it('runs the accessibility rules for markup', () => {
    const code = 'export function Logo() {\n  return <img src="/logo.png" />;\n}\n';
    const ids = scanContent(code, 'src/Logo.tsx').map((diagnostic) => diagnostic.ruleId);
    expect(ids).toContain('no-img-missing-alt');
  });

  it('runs the prose rules for documents', () => {
    const code = 'Great question! Let me know if you want more.\n';
    const ids = scanContent(code, 'docs/guide.md').map((diagnostic) => diagnostic.ruleId);
    expect(ids).toContain('no-chatbot-residue');
  });

  it('does not run the AST rules for documents', () => {
    const code = '# Guide\n\nRun `de-slop check .` before committing.\n';
    const ids = scanContent(code, 'docs/guide.md').map((diagnostic) => diagnostic.ruleId);
    expect(ids).not.toContain('no-missing-docs');
  });

  it('does not run the prose rules for code', () => {
    const code = 'export const message = "Great question!";\n';
    const ids = scanContent(code, 'src/message.ts').map((diagnostic) => diagnostic.ruleId);
    expect(ids).not.toContain('no-chatbot-residue');
  });

  it('turns a parse failure into one diagnostic and keeps scanning', () => {
    const diagnostics = scanContent('const x = ;', 'src/broken.ts');
    const failures = diagnostics.filter((diagnostic) => diagnostic.ruleId === 'scan-error');
    expect(failures.length).toBeLessThanOrEqual(1);
    for (const failure of failures) {
      expect(failure.severity).toBe('error');
      expect(failure.filePath).toBe('src/broken.ts');
    }
  });

  it('honours the rules filter', () => {
    const code = 'const apiKey = "sk-live-abcdef";\n';
    const diagnostics = scanContent(code, 'src/config.ts', { rules: ['no-hardcoded-secret'] });
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.every((diagnostic) => diagnostic.ruleId === 'no-hardcoded-secret')).toBe(true);
  });

  it('stamps every diagnostic with the file path', () => {
    const code = 'const apiKey = "sk-live-abcdef";\n';
    for (const diagnostic of scanContent(code, 'src/config.ts')) {
      expect(diagnostic.filePath).toBe('src/config.ts');
    }
  });
});

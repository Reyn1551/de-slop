import { describe, expect, it } from 'vitest';
import { applyFixes } from './fixer';
import { scanSource } from './scanner';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';

function codeOf(path: string): string {
  return readFileSync(path, 'utf8');
}

function ids(code: string, filePath = 'sample.ts'): string[] {
  return scanSource(code, filePath).map((d) => d.ruleId);
}

describe('scanner core', () => {
  it('returns empty array for clean code', () => {
    expect(scanSource('const x = 1;\nconsole.log(x);\n', 'clean.ts')).toEqual([]);
  });

  it('attaches filePath and 1-based line/column', () => {
    const diags = scanSource('function f() {\n  return 1;\n  const dead = 2;\n}\nf();\n', 'loc.ts', {
      rules: ['no-dead-code'],
    });
    expect(diags).toHaveLength(1);
    expect(diags[0].filePath).toBe('loc.ts');
    expect(diags[0].line).toBe(3);
    expect(diags[0].column).toBeGreaterThanOrEqual(1);
  });

  it('filters rules via options.rules', () => {
    const code = 'function f() {\n  return 1;\n  const dead = 2;\n}\nf();\nconst unused = 3;\n';
    const onlyDead = ids(code);
    const filtered = scanSource(code, 'f.ts', { rules: ['no-dead-code'] }).map((d) => d.ruleId);
    expect(filtered).toEqual(['no-dead-code']);
    expect(onlyDead).toContain('no-unused-var');
  });

  it('parses jsx and module extensions', () => {
    const code = 'function f() {\n  return 1;\n  const dead = 2;\n}\n';
    for (const p of ['a.tsx', 'b.jsx', 'c.mjs', 'd.cjs']) {
      expect(ids(code, p)).toContain('no-dead-code');
    }
  });
});

describe('no-redundant-comment', () => {
  it('flags comment that paraphrases the statement below', () => {
    const code = '// increment the counter\ncounter++;\n';
    expect(ids(code)).toContain('no-redundant-comment');
  });

  it('flags short comment naming an identifier from the statement below', () => {
    const code = '// set total\ntotal = price * qty;\n';
    expect(ids(code)).toContain('no-redundant-comment');
  });

  it('ignores comments that add information', () => {
    const code = '// HACK: workaround for safari bug #1234\ncounter++;\n';
    expect(ids(code)).not.toContain('no-redundant-comment');
  });

  it('provides a fix that removes the comment', () => {
    const diags = scanSource('// increment the counter\ncounter++;\n', 'c.ts', {
      rules: ['no-redundant-comment'],
    });
    expect(diags[0].fix).toBeDefined();
    expect(applyFixes('// increment the counter\ncounter++;\n', diags)).toBe('counter++;\n');
  });
});

describe('no-dead-code', () => {
  it('flags statements after return in the same block', () => {
    const code = 'function f() {\n  return 1;\n  const dead = 2;\n}\nf();\n';
    const diags = scanSource(code, 'd.ts', { rules: ['no-dead-code'] });
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe('no-dead-code');
  });

  it('flags statements after throw/break/continue', () => {
    expect(ids('function f() {\n  throw new Error();\n  cleanup();\n}\nf();\n')).toContain('no-dead-code');
    expect(ids('while (true) {\n  break;\n  cleanup();\n}\n')).toContain('no-dead-code');
    expect(ids('for (;;) {\n  continue;\n  cleanup();\n}\n')).toContain('no-dead-code');
  });

  it('ignores reachable code after an if-branch return', () => {
    const code = 'function f(x: boolean) {\n  if (x) {\n    return 1;\n  }\n  return 2;\n}\nf(true);\n';
    expect(ids(code)).not.toContain('no-dead-code');
  });

  it('fix removes dead statements', () => {
    const code = 'function f() {\n  return 1;\n  const dead = 2;\n  console.log(dead);\n}\nf();\n';
    const diags = scanSource(code, 'd.ts', { rules: ['no-dead-code'] });
    const fixed = applyFixes(code, diags);
    expect(fixed).toBe('function f() {\n  return 1;\n}\nf();\n');
  });
});

describe('no-over-wrapper', () => {
  it('flags function that only forwards identical args', () => {
    const code = 'function add(a: number, b: number) {\n  return mathAdd(a, b);\n}\nadd(1, 2);\n';
    const diags = scanSource(code, 'w.ts', { rules: ['no-over-wrapper'] });
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe('warning');
    expect(diags[0].fix).toBeUndefined();
  });

  it('flags arrow wrapper', () => {
    const code = 'const run = (task: string) => execute(task);\nrun("x");\n';
    expect(ids(code)).toContain('no-over-wrapper');
  });

  it('ignores wrappers that transform args', () => {
    const code = 'function double(a: number) {\n  return mathAdd(a, a);\n}\ndouble(2);\n';
    expect(ids(code)).not.toContain('no-over-wrapper');
  });

  it('ignores functions with extra statements or closures', () => {
    const code = 'const factor = 2;\nfunction scaled(a: number) {\n  return multiply(a, factor);\n}\nscaled(1);\n';
    expect(ids(code)).not.toContain('no-over-wrapper');
  });
});

describe('no-unused-var', () => {
  it('flags variable never referenced', () => {
    const code = 'const unused = 42;\nconst used = 1;\nconsole.log(used);\n';
    const diags = scanSource(code, 'u.ts', { rules: ['no-unused-var'] });
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toContain('unused');
  });

  it('ignores underscore-prefixed, exported and referenced vars', () => {
    const code = 'const _skip = 1;\nexport const shared = 2;\nconst used = 3;\nconsole.log(used);\n';
    expect(ids(code)).not.toContain('no-unused-var');
  });

  it('ignores destructure from a call expression', () => {
    const code = 'const { a, b } = makePair();\nconsole.log(a);\n';
    expect(ids(code)).not.toContain('no-unused-var');
  });

  it('fix removes declaration with pure initializer', () => {
    const code = 'const unused = 42;\nconst used = 1;\nconsole.log(used);\n';
    const diags = scanSource(code, 'u.ts', { rules: ['no-unused-var'] });
    expect(applyFixes(code, diags)).toBe('const used = 1;\nconsole.log(used);\n');
  });
});

describe('no-empty-catch', () => {
  it('flags catch with empty block', () => {
    const code = 'try {\n  risky();\n} catch (e) {\n}\n';
    const diags = scanSource(code, 'e.ts', { rules: ['no-empty-catch'] });
    expect(diags).toHaveLength(1);
    expect(diags[0].fix).toBeUndefined();
  });

  it('flags catch containing only comments', () => {
    const code = 'try {\n  risky();\n} catch (e) {\n  // ignore\n}\n';
    expect(ids(code)).toContain('no-empty-catch');
  });

  it('ignores catch with handling code', () => {
    const code = 'try {\n  risky();\n} catch (e) {\n  console.error(e);\n}\n';
    expect(ids(code)).not.toContain('no-empty-catch');
  });
});

describe('no-hardcoded-secret', () => {
  it('flags api-key-looking string assigned to secret-named variable', () => {
    const code = 'const apiKey = "sk-abc123def456";\nconsole.log(apiKey);\n';
    const diags = scanSource(code, 's.ts', { rules: ['no-hardcoded-secret'] });
    expect(diags).toHaveLength(1);
    expect(diags[0].severity).toBe('error');
  });

  it('flags known token prefixes and password-named vars', () => {
    expect(ids('const token = "ghp_abcdefghij1234";\nconsole.log(token);\n')).toContain('no-hardcoded-secret');
    expect(ids('const password = "Sup3rSecret99";\nconsole.log(password);\n')).toContain('no-hardcoded-secret');
  });

  it('ignores placeholders, env refs and short strings', () => {
    const code =
      'const apiKey = "your-api-key";\n' +
      'const token = process.env.TOKEN;\n' +
      'const secret = "xxx";\n' +
      'const password = "changeme";\n' +
      'const label = "api key";\n' +
      'console.log(apiKey, token, secret, password, label);\n';
    expect(ids(code)).not.toContain('no-hardcoded-secret');
  });

  it('ignores long strings without secret shape', () => {
    const code = 'const apiKey = "this is just an ordinary sentence";\nconsole.log(apiKey);\n';
    expect(ids(code)).not.toContain('no-hardcoded-secret');
  });
});

describe('no-injection-risk', () => {
  it('flags SQL injection via string concatenation with user input', () => {
    const code =
      'const query = "SELECT * FROM users WHERE id = " + req.body.id;\n' +
      'db.query(query);\n';
    const diags = scanSource(code, 'inj.ts', { rules: ['no-injection-risk'] });
    expect(diags.some((d) => d.ruleId === 'no-injection-risk')).toBe(true);
  });

  it('flags command injection in exec with user input', () => {
    const code = 'const out = exec("ls -la " + req.query.dir);\n';
    const diags = scanSource(code, 'cmd.ts', { rules: ['no-injection-risk'] });
    expect(diags.some((d) => d.ruleId === 'no-injection-risk')).toBe(true);
  });

  it('flags XSS via innerHTML with user input', () => {
    const code = 'el.innerHTML = userInput;\n';
    const diags = scanSource(code, 'xss.ts', { rules: ['no-injection-risk'] });
    expect(diags.some((d) => d.ruleId === 'no-injection-risk')).toBe(true);
  });

  it('does not flag safe queries without user input', () => {
    const code = 'const query = "SELECT * FROM users WHERE id = " + 42;\n';
    expect(scanSource(code, 'safe.ts', { rules: ['no-injection-risk'] })).toEqual([]);
  });
});

describe('no-unresolved-import', () => {
  it('flags relative import that resolves nowhere', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-import-'));
    const file = join(dir, 'real-file.ts');
    writeFileSync(file, 'import { thing } from "./ghost-module";\nconsole.log(thing);\n');
    const diags = scanSource(codeOf(file), file, { rules: ['no-unresolved-import'] });
    expect(diags.some((d) => d.ruleId === 'no-unresolved-import')).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('accepts import that resolves to existing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-import-'));
    const file = join(dir, 'real-file.ts');
    const sibling = join(dir, 'ghost-module.ts');
    writeFileSync(sibling, 'export const thing = 1;\n');
    writeFileSync(file, 'import { thing } from "./ghost-module";\nconsole.log(thing);\n');
    expect(scanSource(codeOf(file), file, { rules: ['no-unresolved-import'] })).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('skips scans of virtual/in-memory files', () => {
    const code = 'import { thing } from "./ghost-module";\nconsole.log(thing);\n';
    expect(scanSource(code, 'virtual.ts', { rules: ['no-unresolved-import'] })).toEqual([]);
  });

  it('does not flag bare package imports', () => {
    const code = 'import { readFile } from "node:fs";\nconsole.log(readFile);\n';
    expect(scanSource(code, '/tmp/real-dir/pkg.ts', { rules: ['no-unresolved-import'] })).toEqual([]);
  });
});

describe('no-generic-name', () => {
  it('flags generic variable names', () => {
    const code = 'const data = fetchAll();\nconst result = process(data);\nconsole.log(result);\n';
    const diags = scanSource(code, 'gen.ts', { rules: ['no-generic-name'] });
    expect(diags.some((d) => d.ruleId === 'no-generic-name')).toBe(true);
  });

  it('allows descriptive names', () => {
    const code = 'const userList = fetchAll();\nconst total = process(userList);\nconsole.log(total);\n';
    expect(scanSource(code, 'ok.ts', { rules: ['no-generic-name'] })).toEqual([]);
  });
});

describe('no-sycophancy', () => {
  it('flags uncritical agreement comments', () => {
    const code = '// Great point, exactly as you said — I agree completely\nconst fix = applyPatch(patch);\nconsole.log(fix);\n';
    const diags = scanSource(code, 'syc.ts', { rules: ['no-sycophancy'] });
    expect(diags.some((d) => d.ruleId === 'no-sycophancy')).toBe(true);
  });

  it('allows factual comments', () => {
    const code = '// Apply the patch from the hotfix branch\nconst fix = applyPatch(patch);\nconsole.log(fix);\n';
    expect(scanSource(code, 'ok.ts', { rules: ['no-sycophancy'] })).toEqual([]);
  });
});

describe('no-accept-all', () => {
  it('flags pasted error comments', () => {
    const code = '// ReferenceError: foo is not defined\nconst foo = bar();\nconsole.log(foo);\n';
    const diags = scanSource(code, 'acc.ts', { rules: ['no-accept-all'] });
    expect(diags.some((d) => d.ruleId === 'no-accept-all')).toBe(true);
  });

  it('flags leftover debug residue', () => {
    const code = '// temporarily logging for debugging purposes\nconst x = compute();\nconsole.log(x);\n';
    const diags = scanSource(code, 'dbg.ts', { rules: ['no-accept-all'] });
    expect(diags.some((d) => d.ruleId === 'no-accept-all')).toBe(true);
  });

  it('allows normal comments', () => {
    const code = '// Recompute totals after the refund\nconst x = compute();\nconsole.log(x);\n';
    expect(scanSource(code, 'ok.ts', { rules: ['no-accept-all'] })).toEqual([]);
  });
});

describe('no-missing-docs', () => {
  it('flags exported functions without JSDoc', () => {
    const code = 'export function calculateTotal(items: number[]): number {\n  return items.reduce((a, b) => a + b, 0);\n}\n';
    const diags = scanSource(code, 'doc.ts', { rules: ['no-missing-docs'] });
    expect(diags.some((d) => d.ruleId === 'no-missing-docs')).toBe(true);
  });

  it('accepts exported functions with JSDoc', () => {
    const code = '/** Sums a list of numbers. */\nexport function calculateTotal(items: number[]): number {\n  return items.reduce((a, b) => a + b, 0);\n}\n';
    expect(scanSource(code, 'doc.ts', { rules: ['no-missing-docs'] })).toEqual([]);
  });

  it('does not flag internal (non-exported) functions', () => {
    const code = 'function internalHelper() {\n  return 1;\n}\nconsole.log(internalHelper);\n';
    expect(scanSource(code, 'doc.ts', { rules: ['no-missing-docs'] })).toEqual([]);
  });
});

describe('no-debug-logging', () => {
  it('flags console.log when it appears 3+ times', () => {
    const code =
      'console.log("a");\n' +
      'console.log("b");\n' +
      'console.log("c");\n';
    const diags = scanSource(code, 'dbg.ts', { rules: ['no-debug-logging'] });
    expect(diags.some((d) => d.ruleId === 'no-debug-logging')).toBe(true);
  });

  it('flags console.info and console.warn spam', () => {
    const code =
      'console.info("a");\n' +
      'console.warn("b");\n' +
      'console.warn("c");\n';
    expect(ids(code)).toContain('no-debug-logging');
  });

  it('allows one or two intentional console.log calls', () => {
    const code = 'console.log("start");\nconst x = 1;\nconsole.log(x);\n';
    expect(ids(code)).not.toContain('no-debug-logging');
  });

  it('skips test files', () => {
    const code =
      'console.log("a");\n' +
      'console.log("b");\n' +
      'console.log("c");\n';
    expect(ids(code, 'foo.test.ts')).not.toContain('no-debug-logging');
    expect(ids(code, 'foo.spec.ts')).not.toContain('no-debug-logging');
  });

  it('emits warning severity', () => {
    const code = 'console.log("a");\nconsole.log("b");\nconsole.log("c");\n';
    const diags = scanSource(code, 'dbg.ts', { rules: ['no-debug-logging'] });
    expect(diags[0].severity).toBe('warning');
  });
});

describe('no-code-bloat', () => {
  it('flags function with more than 80 lines of body', () => {
    const lines = Array.from({ length: 82 }, (_, i) => `  const v${i} = ${i};`).join('\n');
    const code = `function big() {\n${lines}\n}\nbig();\n`;
    const diags = scanSource(code, 'bloat.ts', { rules: ['no-code-bloat'] });
    expect(diags.some((d) => d.ruleId === 'no-code-bloat')).toBe(true);
  });

  it('flags function with more than 5 parameters', () => {
    const code =
      'function manyArgs(a, b, c, d, e, f) {\n  return a + b + c + d + e + f;\n}\nmanyArgs(1, 2, 3, 4, 5, 6);\n';
    const diags = scanSource(code, 'bloat.ts', { rules: ['no-code-bloat'] });
    expect(diags.some((d) => d.ruleId === 'no-code-bloat')).toBe(true);
  });

  it('flags complex arrow function with long expression body', () => {
    const body = Array.from({ length: 30 }, (_, i) => `user.field${i}`).join(' + ');
    const code = `const total = (user) => ${body};\nconsole.log(total);\n`;
    const diags = scanSource(code, 'bloat.ts', { rules: ['no-code-bloat'] });
    expect(diags.some((d) => d.ruleId === 'no-code-bloat')).toBe(true);
  });

  it('allows compact functions', () => {
    const code =
      'function small(a: number, b: number): number {\n  return a + b;\n}\n' +
      'const add = (a: number) => a + 1;\n' +
      'const obj = { method(a: number) { return a * 2; } };\n' +
      'console.log(small(1, 2), add(1), obj.method(2));\n';
    expect(ids(code)).not.toContain('no-code-bloat');
  });

  it('emits warning severity', () => {
    const code = 'function manyArgs(a, b, c, d, e, f) {\n  return a + b + c + d + e + f;\n}\nmanyArgs(1, 2, 3, 4, 5, 6);\n';
    const diags = scanSource(code, 'bloat.ts', { rules: ['no-code-bloat'] });
    expect(diags[0].severity).toBe('warning');
  });
});

describe('no-magic-string', () => {
  it('flags hardcoded URL string outside config', () => {
    const code = 'const endpoint = "https://api.example.com/v1/users";\nconsole.log(endpoint);\n';
    const diags = scanSource(code, 'magic.ts', { rules: ['no-magic-string'] });
    expect(diags.some((d) => d.ruleId === 'no-magic-string')).toBe(true);
  });

  it('flags number strings that look like ports or timeouts', () => {
    const code = 'const port = "8080";\nconst timeout = "3600000";\nconsole.log(port, timeout);\n';
    const diags = scanSource(code, 'magic.ts', { rules: ['no-magic-string'] });
    expect(diags.some((d) => d.ruleId === 'no-magic-string')).toBe(true);
  });

  it('flags email-like and domain strings', () => {
    const code = 'const contact = "support@example.com";\nconst host = "api.example.com";\nconsole.log(contact, host);\n';
    const diags = scanSource(code, 'magic.ts', { rules: ['no-magic-string'] });
    expect(diags.some((d) => d.ruleId === 'no-magic-string')).toBe(true);
  });

  it('skips imports, error messages and short strings', () => {
    const code =
      'import { readFile } from "node:fs";\n' +
      'const err = "user not found";\n' +
      'const label = "ok";\n' +
      'const css = { color: "red" };\n' +
      'console.log(readFile, err, label, css.color);\n';
    expect(ids(code)).not.toContain('no-magic-string');
  });

  it('skips URLs inside config files', () => {
    const code = 'export const apiBaseUrl = "https://api.example.com";\n';
    expect(ids(code, 'config.ts')).not.toContain('no-magic-string');
  });

  it('emits warning severity', () => {
    const code = 'const port = "8080";\nconsole.log(port);\n';
    const diags = scanSource(code, 'magic.ts', { rules: ['no-magic-string'] });
    expect(diags[0].severity).toBe('warning');
  });
});

describe('applyFixes', () => {
  it('applies multiple fixes from end of file to start', () => {
    const code = '// increment the counter\ncounter++;\nfunction f() {\n  return 1;\n  const dead = 2;\n}\nf();\n';
    const diags = scanSource(code, 'multi.ts', { rules: ['no-redundant-comment', 'no-dead-code'] });
    const fixed = applyFixes(code, diags);
    expect(fixed).toBe('counter++;\nfunction f() {\n  return 1;\n}\nf();\n');
  });
});

import { describe, expect, it } from 'vitest';
import { applyFixes } from './fixer';
import { scanSource } from './scanner';

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

describe('applyFixes', () => {
  it('applies multiple fixes from end of file to start', () => {
    const code = '// increment the counter\ncounter++;\nfunction f() {\n  return 1;\n  const dead = 2;\n}\nf();\n';
    const diags = scanSource(code, 'multi.ts', { rules: ['no-redundant-comment', 'no-dead-code'] });
    const fixed = applyFixes(code, diags);
    expect(fixed).toBe('counter++;\nfunction f() {\n  return 1;\n}\nf();\n');
  });
});

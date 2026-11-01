const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const { buildFacts, isLintable, lintFile, lintText, summarize, toRange } = require('../src/lint.js');

test('lintText reports violations with a rule id', () => {
  const diagnostics = lintText('const apiKey = "sk-live-abcdef";\n', 'src/config.ts');
  assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === 'no-hardcoded-secret'));
});

test('lintText returns nothing for clean code', () => {
  const code = '/** Adds two numbers. */\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n';
  assert.deepEqual(lintText(code, 'src/add.ts'), []);
});

test('lintText routes markdown to the prose rules', () => {
  const diagnostics = lintText('Great question! Let me know if you need more.\n', 'docs/guide.md');
  assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === 'no-chatbot-residue'));
});

test('lintText routes markup to the accessibility rules', () => {
  const diagnostics = lintText('export function Logo() {\n  return <img src="/logo.png" />;\n}\n', 'src/Logo.tsx');
  assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === 'no-img-missing-alt'));
});

test('lintText routes an MCP config to the MCP rules', () => {
  const config = JSON.stringify({ mcpServers: { remote: { url: 'http://mcp.example.com' } } }, null, 2);
  const diagnostics = lintText(config, '.mcp.json');
  assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === 'no-plaintext-remote'));
});

test('lintFile reads from disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deslop-vscode-'));
  const file = join(dir, 'config.ts');
  writeFileSync(file, 'const apiKey = "sk-live-abcdef";\n');
  const diagnostics = lintFile(file);
  assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === 'no-hardcoded-secret'));
  rmSync(dir, { recursive: true, force: true });
});

test('lintFile reports a read failure as one diagnostic', () => {
  const diagnostics = lintFile('/nonexistent/path/file.ts');
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].ruleId, 'scan-error');
});

test('toRange converts a 1-based position to a zero-based range', () => {
  const range = toRange({ line: 4, column: 7 });
  assert.deepEqual(range.start, { line: 3, character: 6 });
  assert.deepEqual(range.end, { line: 3, character: 7 });
});

test('toRange clamps file-level findings to the first line', () => {
  const range = toRange({ line: 0, column: 0 });
  assert.deepEqual(range.start, { line: 0, character: 0 });
});

test('summarize reports a clean file', () => {
  assert.equal(summarize([]), 'de-slop: clean');
});

test('summarize counts both severities', () => {
  const text = summarize([{ severity: 'error' }, { severity: 'warning' }, { severity: 'warning' }]);
  assert.equal(text, 'de-slop: 1 error, 2 warnings');
});

test('summarize uses the singular for one warning', () => {
  assert.equal(summarize([{ severity: 'warning' }]), 'de-slop: 1 warning');
});

test('buildFacts collects paths, symbols, and scripts', () => {
  const facts = buildFacts(
    [{ filePath: 'src/a.ts', code: 'export function alpha() { return 1; }' }],
    JSON.stringify({ scripts: { build: 'tsc', test: 'vitest' } }),
  );
  assert.deepEqual(facts.files, ['src/a.ts']);
  assert.ok(facts.symbols.includes('alpha'));
  assert.deepEqual(facts.scripts, ['build', 'test']);
});

test('lintText checks agent instructions when facts are supplied', () => {
  const facts = buildFacts([{ filePath: 'src/a.ts', code: 'export function alpha() {}' }], '{"scripts":{"build":"tsc"}}');
  const withFacts = lintText('Run `npm run nope` first.\n', 'AGENTS.md', facts);
  assert.ok(withFacts.some((diagnostic) => diagnostic.ruleId === 'no-stale-script'));

  const withoutFacts = lintText('Run `npm run nope` first.\n', 'AGENTS.md');
  assert.equal(withoutFacts.length, 0);
});

test('lintFile accepts a fact set', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deslop-vscode-facts-'));
  const instructions = join(dir, 'AGENTS.md');
  writeFileSync(instructions, 'Read `src/gone.ts` first.\n');
  const facts = buildFacts([{ filePath: 'src/present.ts', code: 'export const x = 1;' }], '{"scripts":{}}');
  const diagnostics = lintFile(instructions, facts);
  assert.ok(diagnostics.some((diagnostic) => diagnostic.ruleId === 'no-stale-path'));
  rmSync(dir, { recursive: true, force: true });
});

test('isLintable accepts source, markup, docs, and configs', () => {
  for (const file of ['a.ts', 'a.tsx', 'a.js', 'a.json', 'a.css', 'a.md', 'a.rst']) {
    assert.equal(isLintable(file), true, file);
  }
});

test('isLintable skips dependencies and build output', () => {
  assert.equal(isLintable('node_modules/pkg/index.js'), false);
  assert.equal(isLintable('dist/index.js'), false);
  assert.equal(isLintable('.git/config'), false);
});

test('isLintable skips binaries and lockfiles', () => {
  assert.equal(isLintable('logo.png'), false);
  assert.equal(isLintable('package-lock.json.lock'), false);
});

import { describe, expect, it } from 'vitest';
import { collectRepoFacts, CONTEXT_ROT_RULE_IDS, isAgentConfig, scanContextRot } from './index';

const FILES = [
  { filePath: 'packages/core/src/scanner.ts', code: 'export function scanSource(code: string): string[] {\n  return [code];\n}\n' },
  { filePath: 'packages/cli/src/run.js', code: 'export function runCli() {}\n' },
];

const FACTS = collectRepoFacts(FILES, JSON.stringify({ scripts: { build: 'tsc', test: 'vitest' } }));

describe('context-rot', () => {
  it('exposes 8 rules', () => {
    expect(CONTEXT_ROT_RULE_IDS).toHaveLength(8);
  });

  it('recognises agent config filenames', () => {
    expect(isAgentConfig('AGENTS.md')).toBe(true);
    expect(isAgentConfig('repo/CLAUDE.md')).toBe(true);
    expect(isAgentConfig('repo/.cursorrules')).toBe(true);
    expect(isAgentConfig('repo/README.md')).toBe(false);
  });

  it('collects paths, symbols, and scripts', () => {
    expect(FACTS.files).toContain('packages/core/src/scanner.ts');
    expect(FACTS.symbols).toContain('scanSource');
    expect(FACTS.symbols).toContain('runCli');
    expect(FACTS.scripts).toEqual(['build', 'test']);
  });

  it('flags a path that no longer exists', () => {
    const doc = 'Read `packages/core/src/legacy-parser.ts` before editing.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    const stale = diags.find((d) => d.ruleId === 'no-stale-path');
    expect(stale?.message).toContain('legacy-parser.ts');
  });

  it('accepts a path that exists', () => {
    const doc = 'Read `packages/core/src/scanner.ts` before editing.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-stale-path')).toBe(false);
  });

  it('flags a symbol that no longer exists', () => {
    const doc = 'Call `parseLegacyConfig()` first.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-stale-symbol')).toBe(true);
  });

  it('accepts a symbol that exists', () => {
    const doc = 'Call `scanSource()` first.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-stale-symbol')).toBe(false);
  });

  it('flags an npm script that does not exist', () => {
    const doc = 'Run `npm run typecheck` before finishing.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-stale-script')).toBe(true);
  });

  it('accepts an npm script that exists', () => {
    const doc = 'Run `npm run build` before finishing.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-stale-script')).toBe(false);
  });

  it('flags contradictory command spellings', () => {
    const doc = 'Run npx de-slop check .\nAlso run npx de-slop check --lock .\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-contradictory-instruction')).toBe(true);
  });

  it('ignores non-agent files', () => {
    const doc = 'Read `packages/core/src/legacy-parser.ts`.\n';
    expect(scanContextRot(doc, 'README.md', FACTS)).toEqual([]);
  });

  it('respects options.rules', () => {
    const doc = 'Read `packages/core/src/legacy-parser.ts` and call `parseLegacyConfig()`.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS, { rules: ['no-stale-path'] });
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.every((d) => d.ruleId === 'no-stale-path')).toBe(true);
  });

  it('reports 1-based positions', () => {
    const doc = '# Guide\n\nRead `packages/core/src/legacy-parser.ts`.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    for (const diagnostic of diags) {
      expect(diagnostic.line).toBeGreaterThanOrEqual(1);
      expect(diagnostic.column).toBeGreaterThanOrEqual(1);
    }
  });

  it('ignores URLs', () => {
    const doc = 'See https://example.com/packages/core/src/thing.ts for details.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-stale-path')).toBe(false);
  });

  it('flags a file past the line budget', () => {
    const doc = Array.from({ length: 160 }, (_, index) => `- Rule ${index}: run the build.`).join('\n');
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    const found = diags.find((d) => d.ruleId === 'no-oversized-instruction');
    expect(found?.severity).toBe('warning');
  });

  it('treats a file past the hard ceiling as an error', () => {
    const doc = Array.from({ length: 240 }, (_, index) => `- Rule ${index}: run the build.`).join('\n');
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.find((d) => d.ruleId === 'no-oversized-instruction')?.severity).toBe('error');
  });

  it('accepts a file inside the budget', () => {
    const doc = Array.from({ length: 40 }, (_, index) => `- Rule ${index}: run the build.`).join('\n');
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-oversized-instruction')).toBe(false);
  });

  it('flags generic advice the model already follows', () => {
    const doc = '- Follow best practices for error handling.\n- Write clean, maintainable code.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    const found = diags.filter((d) => d.ruleId === 'no-generic-instruction');
    expect(found).toHaveLength(2);
  });

  it('accepts a specific constraint', () => {
    const doc = '- Money is Decimal, never float.\n- Never edit files in /generated/.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-generic-instruction')).toBe(false);
  });

  it('flags a pasted directory tree', () => {
    const tree = [
      '```text',
      '├── src/',
      '│   ├── index.ts',
      '│   └── utils.ts',
      '├── tests/',
      '│   └── index.test.ts',
      '└── package.json',
      '```',
    ].join('\n');
    const diags = scanContextRot(tree, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-self-description')).toBe(true);
  });

  it('accepts a short tree', () => {
    const doc = 'Layout: `packages/core` for logic, `packages/cli` for the binary.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-self-description')).toBe(false);
  });

  it('flags a rule repeated verbatim', () => {
    const rule = '- Never commit secrets or environment files to the repository.';
    const doc = `${rule}\n\nSome prose between them.\n\n${rule}\n`;
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-duplicate-instruction')).toBe(true);
  });

  it('accepts two distinct rules', () => {
    const doc = '- Never commit secrets to the repository.\n- Run npm test before claiming the task is done.\n';
    const diags = scanContextRot(doc, 'AGENTS.md', FACTS);
    expect(diags.some((d) => d.ruleId === 'no-duplicate-instruction')).toBe(false);
  });
});

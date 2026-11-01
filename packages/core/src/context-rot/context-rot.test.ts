import { describe, expect, it } from 'vitest';
import { collectRepoFacts, CONTEXT_ROT_RULE_IDS, isAgentConfig, scanContextRot } from './index';

const FILES = [
  { filePath: 'packages/core/src/scanner.ts', code: 'export function scanSource(code: string): string[] {\n  return [code];\n}\n' },
  { filePath: 'packages/cli/src/run.js', code: 'export function runCli() {}\n' },
];

const FACTS = collectRepoFacts(FILES, JSON.stringify({ scripts: { build: 'tsc', test: 'vitest' } }));

describe('context-rot', () => {
  it('exposes 4 rules', () => {
    expect(CONTEXT_ROT_RULE_IDS).toHaveLength(4);
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
});

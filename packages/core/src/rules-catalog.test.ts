import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rules } from './slop-scanner/rules';
import { agentGuardRules } from './agent-guard';
import { runtimeRules } from './runtime-guard';
import { DESIGN_SLOP_RULE_IDS } from './design-slop';
import { UX_RULE_IDS } from './ux-guard';
import { PROSE_SLOP_RULE_IDS } from './prose-slop';
import { CONTEXT_ROT_RULE_IDS } from './context-rot';
import { MCP_RULE_IDS } from './mcp-guard';
import { COMMIT_RULE_IDS } from './commit-guard';
import { RULES_CATALOG, findRule, rulesByModule } from './rules-catalog';

const AGENT_GUARD_TEXT_RULES = ['no-invisible-unicode', 'no-unsafe-install-docs', 'no-vite-boilerplate'];

/** Every id a module can actually emit. */
const REGISTERED: Record<string, string[]> = {
  'slop-scanner': rules.map((rule) => rule.id),
  'runtime-guard': runtimeRules.map((rule) => rule.id),
  'agent-guard': [...agentGuardRules.map((rule) => rule.id), ...AGENT_GUARD_TEXT_RULES],
  'design-slop': [...DESIGN_SLOP_RULE_IDS, 'design-slop-bundle'],
  'ux-guard': [...UX_RULE_IDS],
  'prose-slop': [...PROSE_SLOP_RULE_IDS, 'prose-slop-bundle'],
  'context-rot': [...CONTEXT_ROT_RULE_IDS],
  'mcp-guard': [...MCP_RULE_IDS, 'mcp-config-unparseable'],
  'commit-guard': [...COMMIT_RULE_IDS, 'commit-empty-message'],
  'design-contract': ['design-contract-drift'],
  'cross-cutting': ['scan-error', 'test-lock', 'package-gate'],
};

/**
 * Ids a module emits as an aggregate or a harness failure, not because a pattern
 * matched. The README counts patterns, so these are excluded from the count.
 */
const SYNTHETIC_IDS = new Set([
  'design-slop-bundle',
  'prose-slop-bundle',
  'mcp-config-unparseable',
  'commit-empty-message',
  'scan-error',
  'test-lock',
  'package-gate',
  'design-contract-drift',
]);

const catalogIds = RULES_CATALOG.map((rule) => rule.id);

describe('rules catalog', () => {
  it('documents every registered rule', () => {
    for (const [module, ids] of Object.entries(REGISTERED)) {
      for (const id of ids) {
        expect(catalogIds, `${module}/${id} is registered but not documented`).toContain(id);
      }
    }
  });

  it('carries no entry for a rule that does not exist', () => {
    const allRegistered = new Set(Object.values(REGISTERED).flat());
    for (const rule of RULES_CATALOG) {
      expect(allRegistered.has(rule.id), `${rule.id} is documented but not registered`).toBe(true);
    }
  });

  it('has no duplicate ids', () => {
    expect(new Set(catalogIds).size).toBe(catalogIds.length);
  });

  it('gives every rule a description of real length', () => {
    for (const rule of RULES_CATALOG) {
      expect(rule.description.length, rule.id).toBeGreaterThan(20);
      expect(rule.description.endsWith('.'), rule.id).toBe(true);
    }
  });

  it('assigns every rule a known module', () => {
    const groups = rulesByModule();
    const grouped = groups.flatMap((group) => group.rules.map((rule) => rule.id));
    expect(grouped.sort()).toEqual([...catalogIds].sort());
  });

  it('orders modules by pipeline precedence', () => {
    expect(rulesByModule().map((group) => group.module)).toEqual([
      'slop-scanner',
      'runtime-guard',
      'agent-guard',
      'design-slop',
      'design-contract',
      'ux-guard',
      'prose-slop',
      'context-rot',
      'mcp-guard',
      'commit-guard',
      'cross-cutting',
    ]);
  });

  it('finds a rule by id', () => {
    expect(findRule('no-chatbot-residue')?.module).toBe('prose-slop');
    expect(findRule('no-plaintext-remote')?.severity).toBe('error');
    expect(findRule('does-not-exist')).toBeUndefined();
  });

  it('documents 94 rules', () => {
    expect(RULES_CATALOG).toHaveLength(94);
  });

  it('counts every module the same way the README does', () => {
    // The README table claims a detector count per module. Nothing else checks
    // it, and it went stale twice during development. The README counts the
    // patterns a module offers; the synthetic aggregate ids (a bundle error, an
    // unparseable-config warning, an empty-message error) are not patterns.
    const readme = readFileSync(join(__dirname, '..', '..', '..', 'README.md'), 'utf8');
    const claimed: Record<string, number> = {};
    for (const line of readme.split('\n')) {
      const row = /^\| `([\w-]+)` \|.*\| ([\w +]+) \|$/.exec(line);
      if (row === null) continue;
      const count = Number(row[2].trim());
      if (!Number.isNaN(count)) claimed[row[1]] = count;
    }

    for (const [module, ids] of Object.entries(REGISTERED)) {
      if (!(module in claimed)) continue;
      const patterns = ids.filter((id) => !SYNTHETIC_IDS.has(id));
      expect(claimed[module], `${module} count in README`).toBe(patterns.length);
    }
  });
});

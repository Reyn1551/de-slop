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
});

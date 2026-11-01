import type { Diagnostic } from '../slop-scanner/types';
import { isMcpConfig, parseMcpConfig } from './parser';
import { noAutoApproveDangerous, noLiteralSecretEnv, noPlaintextRemote, noTyposquatLauncher, noUnpinnedLauncher } from './rules';
import type { McpFinding, McpGuardOptions, McpRuleFn, TextLineLocator } from './types';

export type { McpConfig, McpGuardOptions, McpServerEntry } from './types';
export { isMcpConfig, parseMcpConfig, MCP_CONFIG_PATHS } from './parser';

export const MCP_RULES = {
  'no-plaintext-remote': noPlaintextRemote,
  'no-literal-secret-env': noLiteralSecretEnv,
  'no-unpinned-launcher': noUnpinnedLauncher,
  'no-typosquat-launcher': noTyposquatLauncher,
  'no-auto-approve-dangerous': noAutoApproveDangerous,
} as const;

export type McpRuleId = keyof typeof MCP_RULES;

export const MCP_RULE_IDS = Object.keys(MCP_RULES) as McpRuleId[];

function locatorFor(content: string): TextLineLocator {
  const lines = content.split('\n');
  return {
    lineOf(needle: string) {
      for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].includes(needle)) return index + 1;
      }
      return 1;
    },
  };
}

/**
 * Check an MCP client config. Everything here comes from published guidance:
 * transport integrity and least privilege (MCP security best practices), pinned
 * launches (supply chain), and namespace imitation (arXiv:2608.23897).
 *
 * A config that is not JSON, or has no server map, produces one diagnostic
 * instead of silence: a silently unread file is the failure nobody notices.
 */
export function scanMcpConfig(
  content: string,
  filePath: string,
  options: McpGuardOptions = {},
): Diagnostic[] {
  if (!isMcpConfig(filePath)) return [];

  const config = parseMcpConfig(content, filePath);
  if (config === null) {
    return [{
      ruleId: 'mcp-config-unparseable',
      severity: 'warning',
      message: 'MCP config is not valid JSON with an mcpServers map — de-slop cannot check which tools this client will run',
      filePath,
      line: 1,
      column: 1,
    }];
  }

  const enabled = options.rules
    ? options.rules.filter((id): id is McpRuleId => id in MCP_RULES)
    : MCP_RULE_IDS;

  const context = { config, content, locator: locatorFor(content) };
  const diagnostics: Diagnostic[] = [];
  for (const ruleId of enabled) {
    const rule: McpRuleFn = MCP_RULES[ruleId];
    for (const finding of rule(context)) {
      diagnostics.push({ ...finding, ruleId, filePath });
    }
  }
  return diagnostics;
}

export type { McpFinding, McpRuleFn };

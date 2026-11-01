import type {
  ContextRotContext,
  ContextRotFinding,
  ContextRotOptions,
  ContextRotRuleFn,
  Diagnostic,
  RepoFacts,
  TextLocator,
} from './types';
import { noStalePath, noStaleSymbol, noStaleScript, noContradictoryInstruction } from './rules';

export type { ContextRotOptions, RepoFacts } from './types';
export { collectRepoFacts, normalizeRepoPath } from './facts';

export const CONTEXT_ROT_RULES = {
  'no-stale-path': noStalePath,
  'no-stale-symbol': noStaleSymbol,
  'no-stale-script': noStaleScript,
  'no-contradictory-instruction': noContradictoryInstruction,
} as const;

export type ContextRotRuleId = keyof typeof CONTEXT_ROT_RULES;

export const CONTEXT_ROT_RULE_IDS = Object.keys(CONTEXT_ROT_RULES) as ContextRotRuleId[];

const AGENT_CONFIG = /(?:^|\/)(?:AGENTS|CLAUDE|GEMINI|\.cursorrules|\.windsurfrules|\.clinerules)(?:\.md)?$/i;

export function isAgentConfig(filePath: string): boolean {
  return AGENT_CONFIG.test(filePath) || /(?:^|\/)\.github\/copilot-instructions\.md$/.test(filePath);
}

function locatorFor(code: string): TextLocator {
  const lineStarts = [0];
  for (let index = 0; index < code.length; index += 1) {
    if (code[index] === '\n') lineStarts.push(index + 1);
  }
  return {
    getLineAndCharacterOfPosition(pos: number) {
      let low = 0;
      let high = lineStarts.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (lineStarts[mid] <= pos) low = mid;
        else high = mid - 1;
      }
      return { line: low, character: Math.max(0, pos - lineStarts[low]) };
    },
  };
}

/**
 * Check an agent instruction file against what the repository actually
 * contains. A path, symbol, or script the file promises and the repo no longer
 * has is context rot: the agent follows a stale instruction.
 */
export function scanContextRot(
  code: string,
  filePath: string,
  facts: RepoFacts,
  options: ContextRotOptions = {},
): Diagnostic[] {
  if (!isAgentConfig(filePath)) return [];

  const context: ContextRotContext = { content: code, filePath, facts, locator: locatorFor(code) };
  const enabled = options.rules
    ? options.rules.filter((id): id is ContextRotRuleId => id in CONTEXT_ROT_RULES)
    : CONTEXT_ROT_RULE_IDS;

  const diagnostics: Diagnostic[] = [];
  for (const ruleId of enabled) {
    for (const finding of CONTEXT_ROT_RULES[ruleId](context)) {
      diagnostics.push({ ...finding, ruleId, filePath });
    }
  }
  return diagnostics;
}

export type { ContextRotFinding, ContextRotRuleFn };

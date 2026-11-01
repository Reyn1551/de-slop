import type { ContextRotFinding, ContextRotRuleFn } from '../types';
import { report } from './report';

// Length budget for an instruction file.
//
// Anthropic's memory docs target under 200 lines per CLAUDE.md and warn at
// startup past the recommended length. Practitioner guidance puts the working
// range at 30-80 lines, with 100 as the target and 150 as the warning sign.
// ETH Zurich (arXiv:2602.11988) measured the cost: context files that do not
// change behaviour still add over 20% inference cost, and 2.45 to 3.92 extra
// steps per task.
//
// So the rule is a budget, not a style preference: every line loads into every
// session, and a line the model would have followed anyway is pure cost.
const TARGET_LINES = 100;
const WARNING_LINES = 150;
const ERROR_LINES = 200;

export const noOversizedInstruction: ContextRotRuleFn = (context) => {
  const findings: ContextRotFinding[] = [];
  const lineCount = context.content.split('\n').length;
  if (lineCount <= TARGET_LINES) return findings;

  const severity = lineCount > ERROR_LINES ? 'error' : 'warning';
  const budget = lineCount > ERROR_LINES ? ERROR_LINES : lineCount > WARNING_LINES ? WARNING_LINES : TARGET_LINES;

  findings.push({
    severity,
    message: `${lineCount} lines exceeds the ${budget}-line budget — every line loads into every session; move procedures into a skill and delete any rule a competent developer would not get wrong (arXiv:2602.11988)`,
    line: 1,
    column: 1,
  });

  return findings;
};

// A rule that restates a default the model already follows. ETH Zurich found
// LLM-written context files lost in 5 of 8 settings because they were full of
// instructions like these, and the agent paid for them on every task.
const GENERIC_INSTRUCTION = [
  /follow\s+(?:best\s+)?practices\b/i,
  /write\s+clean(?:\s*,?\s*maintainable)?\s+code\b/i,
  /use\s+descriptive\s+(?:variable\s+|function\s+)?names?\b/i,
  /keep\s+(?:the\s+)?code\s+(?:clean|simple|readable)\b/i,
  /ensure\s+(?:high\s+)?(?:code\s+)?quality\b/i,
  /write\s+(?:good|readable|maintainable)\s+code\b/i,
  /add\s+(?:appropriate|proper|meaningful)\s+comments?\b/i,
  /handle\s+errors?\s+(?:properly|appropriately|gracefully)\b/i,
  /be\s+(?:careful|thorough|mindful)\b/i,
  /think\s+(?:step[- ]by[- ]step|carefully)\b/i,
  /make\s+sure\s+the\s+code\s+works\b/i,
];

export const noGenericInstruction: ContextRotRuleFn = (context) => {
  const findings: ContextRotFinding[] = [];
  const lines = context.content.split('\n');
  let offset = 0;

  for (const line of lines) {
    const isRule = /^\s*(?:[-*+]|\d+[.)])\s/.test(line) || /^\s*#{1,6}\s/.test(line) || line.trim().length > 0;
    if (isRule) {
      for (const pattern of GENERIC_INSTRUCTION) {
        const match = pattern.exec(line);
        if (match === null) continue;
        findings.push(
          report(
            context,
            offset + match.index,
            'warning',
            `Generic instruction ("${match[0]}") — the model already follows this by default; a rule that changes nothing still costs tokens on every run`,
          ),
        );
        break;
      }
    }
    offset += line.length + 1;
  }

  return findings;
};

// A directory tree, dependency list, or stack overview the agent can read from
// the repository itself. ETH Zurich tested exactly this content (repository
// overviews) and measured no effect on task success.
// A box-drawing tree: a branch glyph anywhere in a line, at least one per line.
const TREE_LINE = /[├└]──|[│├└]\s*[│├└]/;

export const noSelfDescription: ContextRotRuleFn = (context) => {
  const findings: ContextRotFinding[] = [];
  const lines = context.content.split('\n');
  let offset = 0;
  let treeLines = 0;

  for (const line of lines) {
    if (TREE_LINE.test(line)) treeLines += 1;
    offset += line.length + 1;
  }

  if (treeLines >= 5) {
    const index = context.content.search(new RegExp(TREE_LINE.source, 'm'));
    findings.push(
      report(
        context,
        Math.max(0, index),
        'warning',
        `${treeLines} lines of directory listing — the agent can read the tree itself; repository overviews measured no effect on task success (arXiv:2602.11988)`,
      ),
    );
  }

  return findings;
};

// A rule stated twice, or two rules that disagree. A duplicate wastes tokens;
// a contradiction makes behaviour unpredictable because the model picks one.
export const noDuplicateInstruction: ContextRotRuleFn = (context) => {
  const findings: ContextRotFinding[] = [];
  const lines = context.content.split('\n');
  const seen = new Map<string, number>();
  let offset = 0;

  for (const line of lines) {
    const normalized = line
      .replace(/^\s*(?:[-*+]|\d+[.)])\s*/, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized.length < 25) {
      offset += line.length + 1;
      continue;
    }

    const previous = seen.get(normalized);
    if (previous !== undefined) {
      findings.push(
        report(
          context,
          offset,
          'warning',
          `Rule repeated verbatim (first stated on line ${previous}) — a duplicate costs tokens and gives a contradiction somewhere to hide`,
        ),
      );
    } else {
      seen.set(normalized, offset === 0 ? 1 : context.locator.getLineAndCharacterOfPosition(offset).line + 1);
    }
    offset += line.length + 1;
  }

  return findings;
};

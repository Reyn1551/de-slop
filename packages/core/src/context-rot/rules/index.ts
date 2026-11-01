import type { ContextRotFinding, ContextRotRuleFn } from '../types';

// Treude & Baltes, "Context Rot in AI-Assisted Software Development"
// (arXiv:2606.09090): agent config files describe code that later moves. Their
// README/wiki consistency checker found stale code-element references in 23% of
// 356 sampled repositories. This rule ports that check to AGENTS.md and friends:
// a path or symbol the file promises, which no longer exists.

const PATH_IN_BACKTICKS = /`([\w./-]+\.[a-z]{1,4})`/gi;
const PATH_BARE = /\b((?:packages|src|lib|app|docs|tests?)\/[\w./-]+\.[a-z]{1,4})\b/g;
const SYMBOL_REFERENCE = /`([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\(\))`/g;

const MINIMUM_SEGMENTS = 2;

function looksLikePath(value: string): boolean {
  if (value.startsWith('http') || value.includes('://')) return false;
  return value.split('/').length >= MINIMUM_SEGMENTS;
}

function insideUrl(content: string, index: number): boolean {
  const lineStart = content.lastIndexOf('\n', index - 1) + 1;
  const prefix = content.slice(lineStart, index);
  return /https?:\/\/\S*$/.test(prefix);
}

function resolvePath(reference: string, facts: { files: string[] }): boolean {
  const normalized = reference.replace(/^\.\//, '');
  return facts.files.some(
    (file) => file === normalized || file.endsWith(`/${normalized}`),
  );
}

export const noStalePath: ContextRotRuleFn = (context) => {
  const findings: ContextRotFinding[] = [];
  const seen = new Set<string>();

  for (const pattern of [PATH_IN_BACKTICKS, PATH_BARE]) {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of context.content.matchAll(global)) {
      const reference = match[1];
      const index = match.index ?? 0;
      if (!looksLikePath(reference) || seen.has(reference)) continue;
      if (insideUrl(context.content, index)) continue;
      if (resolvePath(reference, context.facts)) continue;
      seen.add(reference);
      const position = context.locator.getLineAndCharacterOfPosition(index);
      findings.push({
        severity: 'warning',
        message: `Stale path "${reference}" — no such file in the repo; agent instructions describing moved or deleted code are context rot (arXiv:2606.09090)`,
        line: position.line + 1,
        column: position.character + 1,
      });
    }
  }

  return findings;
};

export const noStaleSymbol: ContextRotRuleFn = (context) => {
  const findings: ContextRotFinding[] = [];
  if (context.facts.symbols.length === 0) return findings;

  const symbols = new Set(context.facts.symbols);
  const seen = new Set<string>();

  for (const match of context.content.matchAll(SYMBOL_REFERENCE)) {
    const name = match[1].replace(/\(\)$/, '');
    if (seen.has(name)) continue;
    if (symbols.has(name)) continue;
    if (name.includes('.')) continue;
    seen.add(name);
    const position = context.locator.getLineAndCharacterOfPosition(match.index ?? 0);
    findings.push({
      severity: 'warning',
      message: `Stale symbol "${name}()" — no declaration with that name; the instruction points at code that no longer exists`,
      line: position.line + 1,
      column: position.character + 1,
    });
  }

  return findings;
};

export const noStaleScript: ContextRotRuleFn = (context) => {
  const findings: ContextRotFinding[] = [];
  if (context.facts.scripts.length === 0) return findings;

  const scripts = new Set(context.facts.scripts);
  const seen = new Set<string>();

  for (const match of context.content.matchAll(/\bnpm run ([\w:-]+)/g)) {
    const script = match[1];
    if (scripts.has(script) || seen.has(script)) continue;
    seen.add(script);
    const position = context.locator.getLineAndCharacterOfPosition(match.index ?? 0);
    findings.push({
      severity: 'warning',
      message: `Stale script "npm run ${script}" — package.json has no such script; the command an agent is told to run will fail`,
      line: position.line + 1,
      column: position.character + 1,
    });
  }

  return findings;
};

export const noContradictoryInstruction: ContextRotRuleFn = (context) => {
  const findings: ContextRotFinding[] = [];

  const commands = new Set<string>();
  for (const match of context.content.matchAll(/\b(npx? (?:de-slop|eslint|prettier|tsc|vitest|jest)[\w .:/@-]*)/g)) {
    commands.add(match[1].trim());
  }
  if (commands.size < 2) return findings;

  const index = context.content.indexOf([...commands][0]);
  const position = context.locator.getLineAndCharacterOfPosition(Math.max(0, index));
  findings.push({
    severity: 'warning',
    message: `${commands.size} different command spellings in one instruction file (${[...commands].slice(0, 3).join(' | ')}) — an agent will run whichever it reads last; keep one form`,
    line: position.line + 1,
    column: position.character + 1,
  });

  return findings;
};

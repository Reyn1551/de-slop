import { ParseSession, scanSources, type SourceInput, type ScanOptions } from './slop-scanner/scanner';
import { runtimeRules } from './runtime-guard';
import { agentGuardRules } from './agent-guard';
import { agentGuardScan, TEXT_RULE_IDS } from './agent-guard';
import { designSlopScan } from './design-slop';
import { scanMcpConfig } from './mcp-guard';
import { scanProse } from './prose-slop';
import { scanUx } from './ux-guard';
import type { Diagnostic } from './slop-scanner/types';
import type { SourceFile } from './slop-scanner/ts-api';

export interface ScanContentOptions {
  rules?: string[];
}

export interface BatchResult {
  filePath: string;
  diagnostics: Diagnostic[];
}

const CODE_EXTENSION = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/;
const MARKUP_EXTENSION = /\.(?:tsx|jsx|html?|vue|svelte|astro|css|scss|sass|less)$/;
const DOC_EXTENSION = /\.(?:md|mdx|markdown|txt|rst|adoc)$/;

function runDetector(filePath: string, label: string, detect: () => Diagnostic[]): Diagnostic[] {
  try {
    return detect();
  } catch (err) {
    return [{
      ruleId: 'scan-error',
      severity: 'error',
      message: `failed to ${label}: ${err instanceof Error ? err.message : String(err)}`,
      filePath,
      line: 0,
      column: 0,
    }];
  }
}

/**
 * Run every detector that applies to one already-parsed file.
 *
 * The AST tree is passed in, so slop-scanner, runtime-guard, and agent-guard
 * share one parse instead of three.
 */
function scanParsed(
  code: string,
  filePath: string,
  sourceFile: SourceFile | undefined,
  options: ScanContentOptions,
  slopDiagnostics: Diagnostic[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [...slopDiagnostics];

  if (sourceFile !== undefined) {
    diagnostics.push(...runDetector(filePath, 'check runtime guards', () => {
      const active = options.rules
        ? runtimeRules.filter((rule) => options.rules!.includes(rule.id))
        : runtimeRules;
      const found: Diagnostic[] = [];
      for (const rule of active) {
        for (const finding of rule.check(sourceFile)) found.push({ ...finding, ruleId: rule.id, filePath });
      }
      return found;
    }));

    diagnostics.push(...runDetector(filePath, 'check agent guards', () => {
      const active = options.rules
        ? agentGuardRules.filter((rule) => options.rules!.includes(rule.id))
        : agentGuardRules;
      const found: Diagnostic[] = [];
      for (const rule of active) {
        for (const finding of rule.check(sourceFile, { filePath, fileExists: () => true })) {
          found.push({ ...finding, ruleId: rule.id, filePath });
        }
      }
      return found;
    }));
  }

  // The text lane of agent-guard runs for every file, code or not, and reuses
  // the tree this call already holds.
  diagnostics.push(...runDetector(filePath, 'check agent guard text rules', () => {
    const textOnly = options.rules
      ? { rules: options.rules.filter((id) => TEXT_RULE_IDS[id] === true) }
      : { rules: Object.keys(TEXT_RULE_IDS) };
    return agentGuardScan(code, filePath, textOnly, sourceFile);
  }));

  diagnostics.push(...runDetector(filePath, 'check design', () => designSlopScan(code, filePath, options)));

  if (MARKUP_EXTENSION.test(filePath)) {
    diagnostics.push(...runDetector(filePath, 'check accessibility', () => scanUx(code, filePath, options)));
  }

  if (DOC_EXTENSION.test(filePath)) {
    diagnostics.push(...runDetector(filePath, 'check prose', () => scanProse(code, filePath, options)));
  }

  if (/mcp/i.test(filePath) && /\.json$/i.test(filePath)) {
    diagnostics.push(...runDetector(filePath, 'check MCP config', () => scanMcpConfig(code, filePath, options)));
  }

  return diagnostics;
}

/** Scan one source without a shared session. Convenient, not fast. */
export function scanContent(
  code: string,
  filePath: string,
  options: ScanContentOptions = {},
): Diagnostic[] {
  const session = new ParseSession();
  let sourceFile: SourceFile | undefined;
  if (CODE_EXTENSION.test(filePath)) {
    try {
      sourceFile = session.parse(code, filePath);
    } catch (err) {
      return [{
        ruleId: 'scan-error',
        severity: 'error',
        message: `failed to parse: ${err instanceof Error ? err.message : String(err)}`,
        filePath,
        line: 0,
        column: 0,
      }];
    }
  }

  const slop = sourceFile === undefined ? [] : runDetector(filePath, 'parse', () => []);
  return scanParsed(code, filePath, sourceFile, options, slop);
}

/**
 * Scan many files. One virtual filesystem and one snapshot serve the whole
 * batch, and every file is parsed once for all three AST modules.
 */
export function scanBatch(
  sources: { filePath: string; code: string }[],
  options: ScanContentOptions = {},
): BatchResult[] {
  const session = new ParseSession();
  const codeSources: SourceInput[] = sources.filter((source) => CODE_EXTENSION.test(source.filePath));
  const parsed = session.parseAll(codeSources);

  const slopOptions: ScanOptions = options.rules ? { rules: options.rules } : {};
  const slopResults = scanSources(codeSources, slopOptions);
  const slopByPath = new Map<string, Diagnostic[]>();
  codeSources.forEach((source, index) => {
    slopByPath.set(source.filePath, slopResults[index] ?? []);
  });

  return sources.map((source) => ({
    filePath: source.filePath,
    diagnostics: scanParsed(
      source.code,
      source.filePath,
      parsed.get(source.filePath),
      options,
      slopByPath.get(source.filePath) ?? [],
    ),
  }));
}

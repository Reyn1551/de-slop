import { scanSource } from './slop-scanner';
import { guardSource } from './runtime-guard';
import { agentGuardScan } from './agent-guard';
import { designSlopScan } from './design-slop';
import { scanProse } from './prose-slop';
import { scanUx } from './ux-guard';
import type { Diagnostic } from './slop-scanner/types';

export interface ScanContentOptions {
  rules?: string[];
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
 * Run every detector that applies to one file and merge the results.
 * The extension decides which parsers run: code gets the AST and runtime
 * rules, markup gets the accessibility rules, docs get the prose rules.
 * Design and agent-guard rules read raw text, so they run everywhere.
 */
export function scanContent(
  code: string,
  filePath: string,
  options: ScanContentOptions = {},
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (CODE_EXTENSION.test(filePath)) {
    diagnostics.push(...runDetector(filePath, 'parse', () => scanSource(code, filePath, options)));
    diagnostics.push(...runDetector(filePath, 'check runtime guards', () => guardSource(code, filePath, options)));
  }

  diagnostics.push(...runDetector(filePath, 'check agent guards', () => agentGuardScan(code, filePath, options)));
  diagnostics.push(...runDetector(filePath, 'check design', () => designSlopScan(code, filePath, options)));

  if (MARKUP_EXTENSION.test(filePath)) {
    diagnostics.push(...runDetector(filePath, 'check accessibility', () => scanUx(code, filePath, options)));
  }

  if (DOC_EXTENSION.test(filePath)) {
    diagnostics.push(...runDetector(filePath, 'check prose', () => scanProse(code, filePath, options)));
  }

  return diagnostics;
}

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { agentGuardScan, guardSource, scanSource } from '@de-slop/core';

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);
const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst']);

/**
 * Run the slop-scanner, the runtime-guard and the agent-guard over one file
 * and merge their diagnostics. Parse/read failures become a single error
 * diagnostic so one broken file does not abort the whole run.
 */
export function scanFile(filePath, rules) {
  const options = rules ? { rules } : {};
  let code;
  try {
    code = readFileSync(filePath, 'utf8');
  } catch (err) {
    return [{
      ruleId: 'scan-error',
      severity: 'error',
      message: err.message,
      filePath,
      line: 0,
      column: 0,
    }];
  }

  const ext = extname(filePath);
  const isCode = CODE_EXTENSIONS.has(ext);

  const diagnostics = [];
  if (isCode) {
    for (const run of [
      () => scanSource(code, filePath, options),
      () => guardSource(code, filePath, options),
    ]) {
      try {
        diagnostics.push(...run());
      } catch (err) {
        diagnostics.push({
          ruleId: 'scan-error',
          severity: 'error',
          message: `failed to parse: ${err.message}`,
          filePath,
          line: 0,
          column: 0,
        });
      }
    }
  }

  try {
    diagnostics.push(...agentGuardScan(code, filePath, options));
  } catch (err) {
    diagnostics.push({
      ruleId: 'scan-error',
      severity: 'error',
      message: `failed to scan: ${err.message}`,
      filePath,
      line: 0,
      column: 0,
    });
  }

  return diagnostics;
}

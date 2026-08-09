import { readFileSync } from 'node:fs';
import { agentGuardScan, guardSource, scanSource } from '@de-slop/core';

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

  const diagnostics = [];
  for (const run of [
    () => scanSource(code, filePath, options),
    () => guardSource(code, filePath, options),
    () => agentGuardScan(code, filePath, options),
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
  return diagnostics;
}

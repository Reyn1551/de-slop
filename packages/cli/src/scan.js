import { readFileSync } from 'node:fs';
import { scanContent } from '@de-slop/core';

/**
 * Read one file and hand it to the core detector fan-out. A read failure
 * becomes a single `scan-error` diagnostic so the run continues.
 */
export function scanFile(filePath, rules) {
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
  return scanContent(code, filePath, rules ? { rules } : {});
}

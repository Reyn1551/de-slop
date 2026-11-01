import { readFileSync } from 'node:fs';
import { scanContent } from '@de-slop/core';
import { designContractScan } from '@de-slop/core/design-contract';

/**
 * Read one file and hand it to the core detector fan-out.
 *
 * A design contract, when the project has one, adds drift detection: a value
 * used often enough to be deliberate, which the contract never declares.
 */
export function scanFile(filePath, rules, contract = null) {
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

  const options = {
    ...(rules ? { rules } : {}),
    contract,
    hasContract: contract !== null,
  };
  const diagnostics = scanContent(code, filePath, options);

  if (contract !== null) {
    diagnostics.push(...designContractScan(code, filePath, { contract }));
  }

  return diagnostics;
}

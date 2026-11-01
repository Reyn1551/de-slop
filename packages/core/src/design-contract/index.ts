import type { Diagnostic } from '../slop-scanner/types';
import { collectDrift } from './drift';
import type { DesignContract, DriftOptions } from './types';

export type { ContractParseError, DesignContract, DesignExemptions, DriftFinding, DriftOptions } from './types';
export { DEFAULT_MINIMUM_OCCURRENCES } from './types';
export { parseDesignContract, extractFrontmatter, isContractParseError } from './parser';
export { findDesignContract, CONTRACT_FILENAMES } from './resolver';
export type { ContractLookup } from './resolver';
export { getExemptions, isExemptColor, isExemptFamily, isExemptFont, isExemptRadius } from './exemptions';
export { collectDrift, scanDrift } from './drift';
export { normalizeColor, relativeLuminance, contrastRatio, opaque } from './color';

export interface ContractScanOptions extends DriftOptions {
  contract: DesignContract | null;
}

/**
 * Drift check for one file. With no contract every value is undeclared by
 * definition, so the check stays silent: the caller reports the missing
 * contract once per run instead of once per file.
 */
export function designContractScan(
  code: string,
  filePath: string,
  options: ContractScanOptions,
): Diagnostic[] {
  if (options.contract === null) return [];
  return collectDrift(code, options.contract, options).map((finding) => ({
    ruleId: 'design-contract-drift',
    severity: 'error' as const,
    message: finding.message,
    filePath,
    line: finding.line,
    column: finding.column,
  }));
}

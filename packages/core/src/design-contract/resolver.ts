import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseDesignContract, isContractParseError } from './parser';
import type { ContractParseError, DesignContract } from './types';

export const CONTRACT_FILENAMES = ['design.md', 'DESIGN.md'];

export interface ContractLookup {
  contract: DesignContract | null;
  error: ContractParseError | null;
  path: string | null;
}

/**
 * Walk up from `startDir` looking for a design contract. The first hit wins,
 * and an unparseable file reports its error instead of being skipped, so a
 * typo in the contract cannot silently disable every exemption.
 */
export function findDesignContract(startDir = process.cwd()): ContractLookup {
  let directory = resolve(startDir);

  for (;;) {
    for (const name of CONTRACT_FILENAMES) {
      for (const candidate of [join(directory, name), join(directory, 'docs', name)]) {
        if (!existsSync(candidate)) continue;
        const parsed = parseDesignContract(readFileSync(candidate, 'utf8'), candidate);
        if (isContractParseError(parsed)) return { contract: null, error: parsed, path: candidate };
        return { contract: parsed, error: null, path: candidate };
      }
    }
    const parent = dirname(directory);
    if (parent === directory) return { contract: null, error: null, path: null };
    directory = parent;
  }
}

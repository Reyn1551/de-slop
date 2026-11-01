import type { Diagnostic } from '../slop-scanner/types';
import type { DesignContract } from '../design-contract/types';

export type { Diagnostic };

export interface DesignSlopOptions {
  rules?: string[];
  /** A parsed DESIGN.md. Declared values stop being flagged. */
  contract?: DesignContract | null;
  /** False when the project has no contract; the bundle threshold tightens. */
  hasContract?: boolean;
}

export interface TextLocator {
  getLineAndCharacterOfPosition(pos: number): { line: number; character: number };
}

export type DesignSlopRuleFn = (
  code: string,
  filePath: string,
  locator: TextLocator,
  contract?: DesignContract | null,
) => Omit<Diagnostic, 'filePath' | 'ruleId'>[];

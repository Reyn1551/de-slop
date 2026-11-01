import type { Diagnostic } from '../slop-scanner/types';

export type { Diagnostic };

export interface UxGuardOptions {
  rules?: string[];
}

export interface TextLocator {
  getLineAndCharacterOfPosition(pos: number): { line: number; character: number };
}

export type UxFinding = Omit<Diagnostic, 'filePath' | 'ruleId'>;

export type UxRuleFn = (code: string, filePath: string, locator: TextLocator) => UxFinding[];

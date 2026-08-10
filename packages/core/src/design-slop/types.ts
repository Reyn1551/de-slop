import type { Diagnostic } from '../slop-scanner/types';

export type { Diagnostic };

export interface DesignSlopOptions {
  rules?: string[];
}

export interface TextLocator {
  getLineAndCharacterOfPosition(pos: number): { line: number; character: number };
}

export type DesignSlopRuleFn = (
  code: string,
  filePath: string,
  locator: TextLocator,
) => Omit<Diagnostic, 'filePath' | 'ruleId'>[];

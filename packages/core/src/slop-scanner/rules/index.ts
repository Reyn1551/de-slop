import type { Rule } from '../types';
import { noDeadCode } from './no-dead-code';
import { noEmptyCatch } from './no-empty-catch';
import { noHardcodedSecret } from './no-hardcoded-secret';
import { noOverWrapper } from './no-over-wrapper';
import { noRedundantComment } from './no-redundant-comment';
import { noUnusedVar } from './no-unused-var';

export const rules: Rule[] = [
  noRedundantComment,
  noDeadCode,
  noOverWrapper,
  noUnusedVar,
  noEmptyCatch,
  noHardcodedSecret,
];

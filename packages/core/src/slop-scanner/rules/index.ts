import type { Rule } from '../types';
import { noAcceptAll } from './no-accept-all';
import { noDeadCode } from './no-dead-code';
import { noEmptyCatch } from './no-empty-catch';
import { noGenericName } from './no-generic-name';
import { noHardcodedSecret } from './no-hardcoded-secret';
import { noInjectionRisk } from './no-injection-risk';
import { noMissingDocs } from './no-missing-docs';
import { noOverWrapper } from './no-over-wrapper';
import { noRedundantComment } from './no-redundant-comment';
import { noSycophancy } from './no-sycophancy';
import { noUnresolvedImport } from './no-unresolved-import';
import { noUnusedVar } from './no-unused-var';

export const rules: Rule[] = [
  noRedundantComment,
  noDeadCode,
  noOverWrapper,
  noUnusedVar,
  noEmptyCatch,
  noHardcodedSecret,
  noGenericName,
  noInjectionRisk,
  noUnresolvedImport,
  noMissingDocs,
  noSycophancy,
  noAcceptAll,
];

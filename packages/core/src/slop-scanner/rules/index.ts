import type { Rule } from '../types';
import { noAcceptAll } from './no-accept-all';
import { noCodeBloat } from './no-code-bloat';
import { noDeadCode } from './no-dead-code';
import { noDebugLogging } from './no-debug-logging';
import { noEmptyCatch } from './no-empty-catch';
import { noGenericName } from './no-generic-name';
import { noHardcodedSecret } from './no-hardcoded-secret';
import { noHeroPill } from './no-hero-pill';
import { noInjectionRisk } from './no-injection-risk';
import { noUnsafeInnerHtml } from './no-unsafe-innerhtml';
import { noMagicString } from './no-magic-string';
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
  noDebugLogging,
  noCodeBloat,
  noMagicString,
  noHeroPill,
  noUnsafeInnerHtml,
];

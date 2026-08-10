import type { Rule } from '../../slop-scanner/types';
import { requireCleanup } from './require-cleanup';
import { noFloatingPromise } from './no-floating-promise';
import { noUnhandledNull } from './no-unhandled-null';
import { noUncleanedTimer } from './no-uncleaned-timer';

export const runtimeRules: Rule[] = [requireCleanup, noFloatingPromise, noUnhandledNull, noUncleanedTimer];

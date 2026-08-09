import type { Rule } from '../../slop-scanner/types';
import { noPromptInjection } from './no-prompt-injection';
import { noMaliciousPattern } from './no-malicious-pattern';
import { noSecretLogging } from './no-secret-logging';
import { noDestructiveCommand } from './no-destructive-command';

export const agentGuardRules: Rule[] = [
  noPromptInjection,
  noMaliciousPattern,
  noSecretLogging,
  noDestructiveCommand,
];
import type { Diagnostic } from '../slop-scanner/types';

export type { Diagnostic };

export interface AgentGuardResult {
  diagnostics: Diagnostic[];
}

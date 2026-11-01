import type { Diagnostic } from '../slop-scanner/types';

export type { Diagnostic };

export interface McpServerEntry {
  name: string;
  /** Remote endpoint, when the server is HTTP-based. */
  url?: string;
  /** Command launched for a stdio server. */
  command?: string;
  args?: string[];
  /** Literal environment values from the config. */
  env?: Record<string, string>;
  /** Tools the client may run without asking. */
  autoApprove?: string[];
}

export interface McpConfig {
  path: string;
  servers: McpServerEntry[];
}

export interface McpGuardOptions {
  rules?: string[];
}

export type McpFinding = Omit<Diagnostic, 'filePath' | 'ruleId'>;

export interface McpContext {
  config: McpConfig;
  content: string;
  locator: TextLineLocator;
}

export interface TextLineLocator {
  lineOf(needle: string): number;
}

export type McpRuleFn = (context: McpContext) => McpFinding[];

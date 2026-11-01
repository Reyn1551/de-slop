import type { McpConfig, McpServerEntry } from './types';

// MCP client configs, in the shapes editors write them. Every one of them nests
// servers under a `mcpServers` key; Cursor's project file and Claude's config
// are the same schema with a different filename.
export const MCP_CONFIG_PATHS = [
  '.mcp.json',
  'mcp.json',
  '.cursor/mcp.json',
  '.vscode/mcp.json',
  '.claude/mcp.json',
  '.config/mcp.json',
];

const MCP_CONFIG_NAME = /(?:^|\/)(?:\.?mcp|mcp[.-]servers?)\.json$/i;

export function isMcpConfig(filePath: string): boolean {
  return MCP_CONFIG_NAME.test(filePath);
}

interface RawServer {
  url?: unknown;
  serverUrl?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
  autoApprove?: unknown;
  alwaysAllow?: unknown;
}

function stringArray(candidate: unknown): string[] | undefined {
  if (!Array.isArray(candidate)) return undefined;
  return candidate.filter((entry): entry is string => typeof entry === 'string');
}

function stringRecord(candidate: unknown): Record<string, string> | undefined {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return undefined;
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(candidate)) {
    if (typeof entry === 'string') record[key] = entry;
  }
  return record;
}

function serverEntry(name: string, raw: RawServer): McpServerEntry {
  const url = typeof raw.url === 'string' ? raw.url : typeof raw.serverUrl === 'string' ? raw.serverUrl : undefined;
  const autoApprove = stringArray(raw.autoApprove) ?? stringArray(raw.alwaysAllow);

  return {
    name,
    url,
    command: typeof raw.command === 'string' ? raw.command : undefined,
    args: stringArray(raw.args),
    env: stringRecord(raw.env),
    autoApprove,
  };
}

/**
 * Parse an MCP client config. Returns null when the file is not JSON or does
 * not carry a server map, so a broken config is reported once rather than
 * producing half a dozen downstream findings.
 */
export function parseMcpConfig(content: string, path: string): McpConfig | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;

  const container = parsed as Record<string, unknown>;
  const servers = container.mcpServers ?? container.servers;
  if (servers === null || typeof servers !== 'object' || Array.isArray(servers)) return null;

  const entries: McpServerEntry[] = [];
  for (const [name, value] of Object.entries(servers)) {
    if (value === null || typeof value !== 'object') continue;
    entries.push(serverEntry(name, value as RawServer));
  }

  return { path, servers: entries };
}

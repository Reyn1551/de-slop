import { describe, expect, it } from 'vitest';
import { MCP_RULE_IDS, parseMcpConfig, scanMcpConfig } from './index';

function config(servers: unknown): string {
  return JSON.stringify({ mcpServers: servers }, null, 2);
}

describe('mcp-guard', () => {
  it('exposes 5 rules', () => {
    expect(MCP_RULE_IDS).toHaveLength(5);
  });

  it('parses a server map', () => {
    const parsed = parseMcpConfig(config({ a: { command: 'node', args: ['x.js'] } }), '.mcp.json');
    expect(parsed?.servers).toHaveLength(1);
    expect(parsed?.servers[0].command).toBe('node');
    expect(parsed?.servers[0].args).toEqual(['x.js']);
  });

  it('returns null for broken JSON', () => {
    expect(parseMcpConfig('{ not json', '.mcp.json')).toBeNull();
  });

  it('returns null when there is no server map', () => {
    expect(parseMcpConfig('{"other": 1}', '.mcp.json')).toBeNull();
  });

  it('flags a plaintext remote server', () => {
    const doc = config({ remote: { url: 'http://mcp.example.com/sse' } });
    const diags = scanMcpConfig(doc, '.mcp.json');
    const hit = diags.find((d) => d.ruleId === 'no-plaintext-remote');
    expect(hit?.severity).toBe('error');
  });

  it('accepts an https remote server', () => {
    const doc = config({ remote: { url: 'https://mcp.example.com/sse' } });
    expect(scanMcpConfig(doc, '.mcp.json').some((d) => d.ruleId === 'no-plaintext-remote')).toBe(false);
  });

  it('accepts a loopback http server', () => {
    const doc = config({ local: { url: 'http://localhost:3000/sse' } });
    expect(scanMcpConfig(doc, '.mcp.json').some((d) => d.ruleId === 'no-plaintext-remote')).toBe(false);
  });

  it('flags a literal secret in env', () => {
    const doc = config({ svc: { command: 'node', env: { API_KEY: 'sk-live-9f8e7d6c5b4a' } } });
    const hit = scanMcpConfig(doc, '.mcp.json').find((d) => d.ruleId === 'no-literal-secret-env');
    expect(hit?.severity).toBe('error');
  });

  it('accepts an env reference', () => {
    const doc = config({ svc: { command: 'node', env: { API_KEY: '${API_KEY}' } } });
    expect(scanMcpConfig(doc, '.mcp.json').some((d) => d.ruleId === 'no-literal-secret-env')).toBe(false);
  });

  it('accepts a placeholder secret', () => {
    const doc = config({ svc: { command: 'node', env: { API_KEY: 'your-api-key-here' } } });
    expect(scanMcpConfig(doc, '.mcp.json').some((d) => d.ruleId === 'no-literal-secret-env')).toBe(false);
  });

  it('flags an unpinned npx launch', () => {
    const doc = config({ svc: { command: 'npx', args: ['-y', 'some-mcp-server'] } });
    const hit = scanMcpConfig(doc, '.mcp.json').find((d) => d.ruleId === 'no-unpinned-launcher');
    expect(hit?.severity).toBe('warning');
  });

  it('accepts a pinned launch', () => {
    const doc = config({ svc: { command: 'npx', args: ['-y', 'some-mcp-server@1.2.3'] } });
    expect(scanMcpConfig(doc, '.mcp.json').some((d) => d.ruleId === 'no-unpinned-launcher')).toBe(false);
  });

  it('accepts a local command that is not a launcher', () => {
    const doc = config({ svc: { command: 'node', args: ['server.js'] } });
    expect(scanMcpConfig(doc, '.mcp.json').some((d) => d.ruleId === 'no-unpinned-launcher')).toBe(false);
  });

  it('flags a typosquatted launch package', () => {
    const doc = config({ svc: { command: 'npx', args: ['-y', 'lodasl@1.0.0'] } });
    const hit = scanMcpConfig(doc, '.mcp.json').find((d) => d.ruleId === 'no-typosquat-launcher');
    expect(hit?.severity).toBe('error');
    expect(hit?.message).toContain('lodash');
  });

  it('accepts a real package name', () => {
    const doc = config({ svc: { command: 'npx', args: ['-y', 'typescript@5.4.0'] } });
    expect(scanMcpConfig(doc, '.mcp.json').some((d) => d.ruleId === 'no-typosquat-launcher')).toBe(false);
  });

  it('flags a wildcard auto-approve', () => {
    const doc = config({ svc: { command: 'node', autoApprove: ['*'] } });
    const hit = scanMcpConfig(doc, '.mcp.json').find((d) => d.ruleId === 'no-auto-approve-dangerous');
    expect(hit?.severity).toBe('warning');
  });

  it('flags auto-approving a destructive tool', () => {
    const doc = config({ svc: { command: 'node', autoApprove: ['search', 'delete_file'] } });
    const hit = scanMcpConfig(doc, '.mcp.json').find((d) => d.ruleId === 'no-auto-approve-dangerous');
    expect(hit?.message).toContain('delete_file');
  });

  it('accepts auto-approving read-only tools', () => {
    const doc = config({ svc: { command: 'node', autoApprove: ['search', 'read_file'] } });
    expect(scanMcpConfig(doc, '.mcp.json').some((d) => d.ruleId === 'no-auto-approve-dangerous')).toBe(false);
  });

  it('reports an unparseable config once', () => {
    const diags = scanMcpConfig('{ broken', '.mcp.json');
    expect(diags).toHaveLength(1);
    expect(diags[0].ruleId).toBe('mcp-config-unparseable');
  });

  it('ignores files that are not MCP configs', () => {
    const doc = config({ svc: { url: 'http://example.com' } });
    expect(scanMcpConfig(doc, 'package.json')).toEqual([]);
  });

  it('honours the rules filter', () => {
    const doc = config({ svc: { url: 'http://example.com', autoApprove: ['*'] } });
    const diags = scanMcpConfig(doc, '.mcp.json', { rules: ['no-plaintext-remote'] });
    expect(diags.every((d) => d.ruleId === 'no-plaintext-remote')).toBe(true);
  });

  it('reports 1-based positions', () => {
    const doc = config({ svc: { url: 'http://example.com', autoApprove: ['delete'] } });
    for (const diagnostic of scanMcpConfig(doc, '.mcp.json')) {
      expect(diagnostic.line).toBeGreaterThanOrEqual(1);
      expect(diagnostic.column).toBeGreaterThanOrEqual(1);
    }
  });

  it('leaves a clean config silent', () => {
    const doc = config({
      'de-slop': {
        command: 'npx',
        args: ['-y', 'de-slop@^0.4.0', 'mcp'],
        env: { API_KEY: '${API_KEY}' },
      },
      remote: { url: 'https://mcp.example.com/sse', autoApprove: ['search'] },
    });
    expect(scanMcpConfig(doc, '.mcp.json')).toEqual([]);
  });
});

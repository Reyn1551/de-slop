import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = resolve(__dirname, '..', '..');
const serverEntry = join(root, 'packages/mcp-server/dist/index.js');

describe('mcp server e2e', () => {
  it('advertises all four tools', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = tools.map((tool: any) => tool.name).sort();
    expect(names).toEqual(['check_package', 'check_slop', 'spec_verify', 'verify_tests']);
    await client.close();
  });

  it('check_slop scans raw code', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const result = await client.callTool({
      name: 'check_slop',
      arguments: { code: 'const apiKey = "sk-live-abcdef";\n// declare unused variable\nlet unused = 1;\n' },
    });
    const payload = JSON.parse((result as any).content[0].text);
    const ruleIds = payload.diagnostics.map((d: any) => d.ruleId);
    expect(ruleIds).toContain('no-hardcoded-secret');
    expect(ruleIds).toContain('no-redundant-comment');
    await client.close();
  });

  it('check_package reports suspicious risk', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const result = await client.callTool({
      name: 'check_package',
      arguments: { name: 'this-package-does-not-exist-xyz12345', ecosystem: 'npm' },
    });
    const payload = JSON.parse((result as any).content[0].text);
    expect(payload.verdict).toBe('not-found');
    await client.close();
  });

  it('spec_verify flags missing functions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'deslop-mcp-spec-'));
    const spec = join(dir, 'de-slop.spec.yml');
    const source = join(dir, 'impl.ts');
    writeFileSync(spec, 'specs:\n  - id: s1\n    functions: [calculateTotal]\n    invariants: []\n');
    writeFileSync(source, 'export function otherThing() { return 1; }\n');

    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const result = await client.callTool({
      name: 'spec_verify',
      arguments: { specPath: spec, sourceGlobs: [`${dir}/*.ts`] },
    });
    const payload = JSON.parse((result as any).content[0].text);
    expect(JSON.stringify(payload)).toContain('missing-function');
    await client.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

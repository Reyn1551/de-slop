import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = resolve(__dirname, '..', '..');
const serverEntry = join(root, 'packages/mcp-server/dist/index.js');

describe('mcp server e2e', () => {
  it('advertises all ten tools', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const { tools } = await client.listTools();
    const names = tools.map((tool: any) => tool.name).sort();
    expect(names).toEqual([
      'check_context_rot',
      'check_degradation',
      'check_design_contract',
      'check_mcp_config',
      'check_package',
      'check_prose',
      'check_slop',
      'check_ux',
      'spec_verify',
      'verify_tests',
    ]);
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

  it('check_prose scores a slop document', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const result = await client.callTool({
      name: 'check_prose',
      arguments: {
        text: "Great question! Let's dive in. This isn't just about code, it's about craft.\n\nThat's the real win.\n",
      },
    });
    const payload = JSON.parse((result as any).content[0].text);
    const ruleIds = payload.diagnostics.map((diagnostic: { ruleId: string }) => diagnostic.ruleId);
    expect(ruleIds).toContain('no-chatbot-residue');
    expect(ruleIds).toContain('no-staged-opener');
    expect(payload.metrics.score).toBeGreaterThan(0);
    await client.close();
  });

  it('check_ux flags an unlabeled icon button and missing alt text', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const result = await client.callTool({
      name: 'check_ux',
      arguments: {
        text: '<div><img src="/logo.png" /><button className="p-1"><svg /></button></div>',
        path: 'src/Header.tsx',
      },
    });
    const payload = JSON.parse((result as any).content[0].text);
    const ruleIds = payload.diagnostics.map((diagnostic: { ruleId: string }) => diagnostic.ruleId);
    expect(ruleIds).toContain('no-img-missing-alt');
    expect(ruleIds).toContain('no-icon-button-unlabeled');
    await client.close();
  });

  it('check_degradation reports erosion and a regression', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);

    const clean = 'export function add(a: number, b: number): number { return a + b; }\n';
    const eroded = [
      'export function handle(input: string): number {',
      '  let total = 0;',
      '  if (input.length > 0) {',
      '    for (const character of input) {',
      '      if (character === "a") { total += 1; }',
      '      else if (character === "b") { total += 2; }',
      '      else if (character === "c") { total += 3; }',
      '      else if (character === "d") { total += 4; }',
      '      else if (character === "e") { total += 5; }',
      '      else if (character === "f") { total += 6; }',
      '      else if (character === "g") { total += 7; }',
      '      else if (character === "h") { total += 8; }',
      '      else if (character === "i") { total += 9; }',
      '      else { total += character.length > 0 ? 1 : 0; }',
      '      if (total > 100 && total % 2 === 0) { total = 0; }',
      '    }',
      '  }',
      '  return total;',
      '}',
      '',
    ].join('\n');

    const result = await client.callTool({
      name: 'check_degradation',
      arguments: {
        files: [{ filePath: 'handle.ts', code: eroded }],
        baseline: [{ filePath: 'handle.ts', code: clean }],
      },
    });
    const payload = JSON.parse((result as any).content[0].text);
    expect(payload.current.erosion).toBeGreaterThan(0);
    expect(payload.delta.degrading).toBe(true);
    expect(payload.delta.reasons.join(' ')).toContain('erosion');
    await client.close();
  });

  it('check_mcp_config flags a plaintext remote', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const result = await client.callTool({
      name: 'check_mcp_config',
      arguments: {
        content: JSON.stringify({ mcpServers: { remote: { url: 'http://mcp.example.com' } } }, null, 2),
        path: '.mcp.json',
      },
    });
    const payload = JSON.parse((result as any).content[0].text);
    const ruleIds = payload.diagnostics.map((diagnostic: { ruleId: string }) => diagnostic.ruleId);
    expect(ruleIds).toContain('no-plaintext-remote');
    await client.close();
  });

  it('check_design_contract reports drift', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const result = await client.callTool({
      name: 'check_design_contract',
      arguments: {
        content: '---\nversion: alpha\ncolors:\n  indigo: "#6366f1"\n---\n# Design\n',
        path: 'DESIGN.md',
        files: [{ filePath: 'src/theme.css', code: '.a { color: #ff0000; }\n.b { color: #ff0000; }\n.c { color: #ff0000; }\n' }],
      },
    });
    const payload = JSON.parse((result as any).content[0].text);
    expect(payload.contract.colors.indigo).toBe('#6366f1');
    expect(payload.diagnostics.length).toBeGreaterThan(0);
    expect(payload.diagnostics[0].ruleId).toBe('design-contract-drift');
    await client.close();
  });

  it('check_context_rot flags a stale path in agent instructions', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [serverEntry] });
    const client = new Client({ name: 'e2e', version: '1.0.0' });
    await client.connect(transport);
    const result = await client.callTool({
      name: 'check_context_rot',
      arguments: {
        content: 'Read `src/legacy-parser.ts` before editing.\n',
        path: 'AGENTS.md',
        files: [{ filePath: 'src/parser.ts', code: 'export function parse() {}\n' }],
        packageJson: JSON.stringify({ scripts: { build: 'tsc' } }),
      },
    });
    const payload = JSON.parse((result as any).content[0].text);
    const ruleIds = payload.diagnostics.map((diagnostic: { ruleId: string }) => diagnostic.ruleId);
    expect(ruleIds).toContain('no-stale-path');
    await client.close();
  });
});

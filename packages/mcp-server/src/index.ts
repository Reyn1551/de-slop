import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';

export const MCP_SERVER_NAME = 'de-slop';

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function registerTools(server: McpServer): void {
  server.tool(
    'check_slop',
    'Scan code for AI slop patterns (redundant comments, dead code, unused vars, security issues) and runtime risks',
    { paths: z.string().optional().describe('Comma-separated paths to scan'), code: z.string().optional().describe('Raw source code to scan') },
    async ({ paths, code }) => {
      const { scanSource } = await import('@de-slop/core/slop-scanner');
      const { guardSource } = await import('@de-slop/core/runtime-guard');
      const diagnostics: unknown[] = [];

      if (code) {
        diagnostics.push(...scanSource(code, 'stdin.ts'));
        diagnostics.push(...guardSource(code, 'stdin.ts'));
      } else if (paths) {
        for (const rawPath of paths.split(',').map((p) => p.trim()).filter(Boolean)) {
          let source: string;
          try {
            source = await readFile(rawPath, 'utf8');
          } catch {
            diagnostics.push({ ruleId: 'scan-error', severity: 'error', message: `cannot read file: ${rawPath}`, filePath: rawPath, line: 0, column: 0 });
            continue;
          }
          diagnostics.push(...scanSource(source, rawPath));
          diagnostics.push(...guardSource(source, rawPath));
        }
      }
      return textResult({ diagnostics });
    },
  );

  server.tool(
    'verify_tests',
    'Verify a test file against its locked AST fingerprint to detect AI manipulation (assertion weakening, skipped/removed tests)',
    { path: z.string().describe('Path to the test file'), storePath: z.string().optional().describe('Path to the test-lock store') },
    async ({ path, storePath }) => {
      const { verifyTestFile, lockTestFile } = await import('@de-slop/core/test-lock');
      try {
        const violations = await verifyTestFile(path, storePath);
        return textResult({ locked: true, violations });
      } catch {
        const fingerprint = await lockTestFile(path, storePath);
        return textResult({ locked: false, hint: 'test file was not locked — run lockTestFile first', fingerprint });
      }
    },
  );

  server.tool(
    'check_package',
    'Check a package for slopsquatting risk: existence, age, and download reputation in the npm/PyPI registry',
    { name: z.string().describe('Package name'), ecosystem: z.enum(['npm', 'pypi']).default('npm') },
    async ({ name, ecosystem }) => {
      const { checkPackage } = await import('@de-slop/core/package-gate');
      const report = await checkPackage(name, ecosystem);
      return textResult(report);
    },
  );

  server.tool(
    'spec_verify',
    'Verify source code against a de-slop.spec.yml spec contract (missing functions, invariant violations)',
    { specPath: z.string().describe('Path to the spec file'), sourceGlobs: z.array(z.string()).describe('Source globs, e.g. ["src/**/*.ts"]') },
    async ({ specPath, sourceGlobs }) => {
      const { runSpecCheck } = await import('@de-slop/core/spec-contractor');
      const result = await runSpecCheck(specPath, sourceGlobs);
      return textResult(result);
    },
  );
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: '0.1.0' });
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export default startMcpServer;

if (require.main === module) {
  startMcpServer().catch((err) => {
    process.stderr.write(`de-slop mcp server error: ${err?.message ?? err}\n`);
    process.exit(1);
  });
}

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
    'Run every de-slop detector over code, markup, or docs: AST slop rules, runtime guards, agent guards, design tells, accessibility, and prose',
    {
      paths: z.string().optional().describe('Comma-separated paths to scan'),
      code: z.string().optional().describe('Raw source code to scan'),
      filename: z.string().optional().describe('Filename for raw code (default stdin.ts); the extension picks the detectors'),
      rules: z.array(z.string()).optional().describe('Only run these rule ids'),
    },
    async ({ paths, code, filename, rules }) => {
      const { scanContent } = await import('@de-slop/core');
      const options = rules ? { rules } : {};
      const diagnostics: unknown[] = [];

      if (code) {
        diagnostics.push(...scanContent(code, filename ?? 'stdin.ts', options));
      } else if (paths) {
        for (const rawPath of paths.split(',').map((p) => p.trim()).filter(Boolean)) {
          let source: string;
          try {
            source = await readFile(rawPath, 'utf8');
          } catch {
            diagnostics.push({ ruleId: 'scan-error', severity: 'error', message: `cannot read file: ${rawPath}`, filePath: rawPath, line: 0, column: 0 });
            continue;
          }
          diagnostics.push(...scanContent(source, rawPath, options));
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

  server.tool(
    'check_prose',
    'Score documentation for AI writing tells: not-X-but-Y contrasts, staged openers, chatbot residue, inflated significance, AI vocabulary, dash overload, bold-label lists, closers',
    {
      text: z.string().optional().describe('Raw prose to score'),
      path: z.string().optional().describe('Path to a Markdown or text file to score'),
      rules: z.array(z.string()).optional().describe('Only run these rule ids'),
    },
    async ({ text, path, rules }) => {
      const { analyzeProse } = await import('@de-slop/core/prose-slop');
      const source = text ?? (path ? await readFile(path, 'utf8') : '');
      const result = analyzeProse(source, path ?? 'stdin.md', rules ? { rules } : {});
      return textResult(result);
    },
  );

  server.tool(
    'check_ux',
    'Check JSX/HTML/CSS for provable accessibility and interaction failures: missing alt text, unlabeled icon buttons, removed focus rings, placeholder-only labels, blocked zoom, small touch targets, motion without reduced-motion, off-grid spacing',
    {
      text: z.string().optional().describe('Raw markup or CSS to check'),
      path: z.string().optional().describe('Path to a markup or CSS file to check'),
      rules: z.array(z.string()).optional().describe('Only run these rule ids'),
    },
    async ({ text, path, rules }) => {
      const { scanUx } = await import('@de-slop/core/ux-guard');
      const source = text ?? (path ? await readFile(path, 'utf8') : '');
      return textResult({ diagnostics: scanUx(source, path ?? 'stdin.tsx', rules ? { rules } : {}) });
    },
  );

  server.tool(
    'check_mcp_config',
    'Check an MCP client config for security defects: plaintext remote transport, literal secrets in env, unpinned launcher packages, typosquatted launcher names, and auto-approval of destructive tools',
    {
      content: z.string().describe('MCP config JSON'),
      path: z.string().describe('Config path, e.g. .mcp.json'),
      rules: z.array(z.string()).optional().describe('Only run these rule ids'),
    },
    async ({ content, path, rules }) => {
      const { scanMcpConfig } = await import('@de-slop/core/mcp-guard');
      return textResult({ diagnostics: scanMcpConfig(content, path, rules ? { rules } : {}) });
    },
  );

  server.tool(
    'check_design_contract',
    'Parse a DESIGN.md contract and check a file for drift: values used often enough to be deliberate (3+ occurrences by default) that the contract never declares',
    {
      content: z.string().describe('Design contract file content, including the --- frontmatter'),
      path: z.string().describe('Contract path, e.g. DESIGN.md'),
      files: z.array(z.object({ filePath: z.string(), code: z.string() })).describe('Files to check against the contract'),
      minimumOccurrences: z.number().optional().describe('Occurrence threshold before an undeclared value counts as drift (default 3)'),
    },
    async ({ content, path, files, minimumOccurrences }) => {
      const { parseDesignContract, isContractParseError, scanDrift } = await import('@de-slop/core/design-contract');
      const parsed = parseDesignContract(content, path);
      if (isContractParseError(parsed)) return textResult({ error: parsed.message, path });

      const diagnostics = files.flatMap((file) =>
        scanDrift(file.code, file.filePath, parsed, minimumOccurrences === undefined ? {} : { minimumOccurrences }),
      );
      return textResult({
        contract: {
          version: parsed.version,
          colors: Object.fromEntries(parsed.colors),
          typography: Object.fromEntries(parsed.typography),
          rounded: Object.fromEntries(parsed.rounded),
          omitted: parsed.omitted,
        },
        diagnostics,
      });
    },
  );

  server.tool(
    'check_context_rot',
    'Check an agent instruction file (AGENTS.md, CLAUDE.md, .cursorrules) against the repo: stale file paths, symbols, and npm scripts that no longer exist (context rot, arXiv:2606.09090)',
    {
      content: z.string().describe('Instruction file content'),
      path: z.string().describe('Instruction file path, e.g. AGENTS.md'),
      files: z.array(z.object({ filePath: z.string(), code: z.string() })).describe('Repository files used to build the fact set'),
      packageJson: z.string().optional().describe('package.json content, for script checks'),
    },
    async ({ content, path, files, packageJson }) => {
      const { collectRepoFacts, scanContextRot } = await import('@de-slop/core/context-rot');
      const facts = collectRepoFacts(files, packageJson);
      return textResult({ diagnostics: scanContextRot(content, path, facts) });
    },
  );

  server.tool(
    'check_degradation',
    'Measure code degradation: structural erosion (complexity mass in functions above cyclomatic 10) and verbosity (flagged plus duplicate lines), against the SlopCodeBench human baselines of 0.34 and 0.19',
    {
      files: z.array(z.object({ filePath: z.string(), code: z.string() })).describe('Files to analyze'),
      baseline: z.array(z.object({ filePath: z.string(), code: z.string() })).optional().describe('Earlier versions to compare against'),
    },
    async ({ files, baseline }) => {
      const { analyzeProject, compareBaseline } = await import('@de-slop/core/degradation');
      const current = analyzeProject(files);
      if (!baseline) return textResult({ current });

      const previous = analyzeProject(baseline);
      return textResult({ current, baseline: previous, delta: compareBaseline(current, previous) });
    },
  );
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: '0.4.0' });
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

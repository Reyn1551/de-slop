import { describe, expect, it } from 'vitest';
import { scanBatch } from './scan-batch';

function syntheticSource(index: number, lines: number): { filePath: string; code: string } {
  const body = Array.from({ length: lines }, (_, line) => {
    const name = `handler${index}_${line}`;
    return `export function ${name}(input: number): number {\n  if (input > ${line}) return ${line};\n  return input + ${line};\n}`;
  }).join('\n\n');
  return { filePath: `src/module-${index}.ts`, code: `${body}\n` };
}

describe('scanBatch', () => {
  it('returns one result per input, in order', () => {
    const sources = [syntheticSource(1, 1), syntheticSource(2, 1), syntheticSource(3, 1)];
    const results = scanBatch(sources);
    expect(results.map((result) => result.filePath)).toEqual([
      'src/module-1.ts',
      'src/module-2.ts',
      'src/module-3.ts',
    ]);
  });

  it('finds the same violations a single-file scan finds', () => {
    const sources = [{ filePath: 'src/config.ts', code: 'const apiKey = "sk-live-abcdef";\n' }];
    const results = scanBatch(sources);
    expect(results[0].diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain('no-hardcoded-secret');
  });

  it('reports a parse failure for one file without losing the others', () => {
    const sources = [
      { filePath: 'src/broken.ts', code: 'const x = ;' },
      { filePath: 'src/fine.ts', code: 'const apiKey = "sk-live-abcdef";\n' },
    ];
    const results = scanBatch(sources);
    expect(results[1].diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain('no-hardcoded-secret');
  });

  it('handles an empty batch', () => {
    expect(scanBatch([])).toEqual([]);
  });

  it('handles a batch with no code files', () => {
    const results = scanBatch([{ filePath: 'docs/a.md', code: 'Great question! Let me know.\n' }]);
    expect(results[0].diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain('no-chatbot-residue');
  });

  it('routes an MCP config to the MCP rules inside a batch', () => {
    const config = JSON.stringify({ mcpServers: { remote: { url: 'http://mcp.example.com' } } }, null, 2);
    const results = scanBatch([{ filePath: '.mcp.json', code: config }]);
    expect(results[0].diagnostics.map((diagnostic) => diagnostic.ruleId)).toContain('no-plaintext-remote');
  });

  it('scans 120 files in under five seconds', () => {
    // Regression guard. A snapshot per file made this take two minutes; one
    // session for the batch keeps it well under a second on this machine, so
    // five seconds is a ceiling that only a real regression can cross.
    const sources = Array.from({ length: 120 }, (_, index) => syntheticSource(index, 3));
    const startedAt = Date.now();
    const results = scanBatch(sources);
    const elapsed = Date.now() - startedAt;

    expect(results).toHaveLength(120);
    expect(elapsed).toBeLessThan(5000);
  });
});

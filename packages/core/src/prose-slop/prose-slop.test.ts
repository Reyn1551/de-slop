import { describe, expect, it } from 'vitest';
import { scanProse, analyzeProse, PROSE_SLOP_RULE_IDS } from './index';

const SLOP_DOC = `# The Ultimate Guide to Shipping

Let's dive into how modern teams build software. Here's what you need to know.

It's not just about writing code. It's about crafting experiences.

This stands as a testament to the evolving landscape of engineering, and plays a
pivotal role in underscoring the importance of collaboration.

Great question! Let me know if you'd like me to expand on any section.

- **Speed:** Ship faster.
- **Quality:** Ship better.
- **Scale:** Ship more.

The real question is whether teams can adapt. At its core, what really matters is
readiness — and this is the deeper issue — because everything — every decision —
rests on it.

That's the real win.
`;

const CLEAN_DOC = `# de-slop

Scans a repository for code an agent wrote without reading it back.

## Install

\`\`\`bash
npm install -D de-slop
\`\`\`

Run \`npx de-slop check .\` to scan. Exit code 1 means at least one error.
Warnings print without failing the build.

The scanner reads each file, builds an AST, and reports rules that catch test
manipulation, hallucinated packages, and comments that restate the code below.

## Modules

| Module | Checks |
|---|---|
| test-lock | test fingerprints |
| package-gate | registry age and downloads |

See \`docs/ARCHITECTURE.md\` for the module map.
`;

describe('prose-slop', () => {
  it('exposes 14 rules', () => {
    expect(PROSE_SLOP_RULE_IDS).toHaveLength(14);
  });

  it('flags not-X-but-Y contrasts', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    expect(diags.some((d) => d.ruleId === 'no-not-x-but-y')).toBe(true);
  });

  it('flags staged openers', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    expect(diags.some((d) => d.ruleId === 'no-staged-opener')).toBe(true);
  });

  it('flags chatbot residue as error', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    const residue = diags.filter((d) => d.ruleId === 'no-chatbot-residue');
    expect(residue.length).toBeGreaterThan(0);
    expect(residue.every((d) => d.severity === 'error')).toBe(true);
  });

  it('flags inflated significance', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    expect(diags.some((d) => d.ruleId === 'no-inflated-significance')).toBe(true);
  });

  it('flags AI vocabulary', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    const vocabulary = diags.filter((d) => d.ruleId === 'no-ai-vocabulary');
    expect(vocabulary.some((d) => /testament|landscape|underscor|pivotal/i.test(d.message))).toBe(true);
  });

  it('flags fake depth', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    expect(diags.some((d) => d.ruleId === 'no-fake-depth')).toBe(true);
  });

  it('flags bold-label lists', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    expect(diags.some((d) => d.ruleId === 'no-bold-decoration')).toBe(true);
  });

  it('flags one-line closers', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    expect(diags.some((d) => d.ruleId === 'no-closer-line')).toBe(true);
  });

  it('flags em dash overload', () => {
    const doc = `A — B — C — D — E — F — G — H — I — J — K — L — M — N — O — P. ${'Filler sentence here. '.repeat(10)}`;
    const diags = scanProse(doc, '/tmp/dashes.md');
    expect(diags.some((d) => d.ruleId === 'no-em-dash-overuse')).toBe(true);
  });

  it('flags stacked hedges', () => {
    const doc = 'The change could potentially improve latency. It might possibly help throughput.';
    const diags = scanProse(doc, '/tmp/hedge.md');
    expect(diags.filter((d) => d.ruleId === 'no-hedge-stack')).toHaveLength(2);
  });

  it('flags sales language', () => {
    const doc = 'The SDK is a game-changer with seamless integration and effortless setup.';
    const diags = scanProse(doc, '/tmp/sales.md');
    expect(diags.filter((d) => d.ruleId === 'no-sales-language').length).toBeGreaterThanOrEqual(2);
  });

  it('flags vague attribution without a link', () => {
    const doc = 'Experts say the approach reduces defects.';
    const diags = scanProse(doc, '/tmp/attribution.md');
    expect(diags.some((d) => d.ruleId === 'no-vague-attribution')).toBe(true);
  });

  it('accepts vague attribution when the paragraph links a source', () => {
    const doc = 'Experts say the approach reduces defects, per [the 2026 study](https://example.com/study).';
    const diags = scanProse(doc, '/tmp/attribution.md');
    expect(diags.some((d) => d.ruleId === 'no-vague-attribution')).toBe(false);
  });

  it('flags Title Case headings', () => {
    const doc = '## Getting Started With The Toolkit\n\nRun the command.\n';
    const diags = scanProse(doc, '/tmp/heading.md');
    expect(diags.some((d) => d.ruleId === 'no-decorative-heading')).toBe(true);
  });

  it('accepts sentence-case headings', () => {
    const doc = '## Getting started with the toolkit\n\nRun the command.\n';
    const diags = scanProse(doc, '/tmp/heading.md');
    expect(diags.some((d) => d.ruleId === 'no-decorative-heading')).toBe(false);
  });

  it('flags repeated sentence openers', () => {
    const doc = 'She opened the file. She read the header. She closed the editor.';
    const diags = scanProse(doc, '/tmp/opener.md');
    expect(diags.some((d) => d.ruleId === 'no-repeated-opener')).toBe(true);
  });

  it('leaves a clean document silent', () => {
    const diags = scanProse(CLEAN_DOC, '/tmp/README.md');
    expect(diags).toEqual([]);
  });

  it('ignores fenced code and inline code', () => {
    const doc = [
      '# Usage',
      '',
      '```ts',
      "const note = \"It's not just fast, it's correct.\";",
      '```',
      '',
      'Call `Great question!` only inside the test fixture.',
      '',
    ].join('\n');
    const diags = scanProse(doc, '/tmp/fenced.md');
    expect(diags).toHaveLength(0);
  });

  it('ignores URLs', () => {
    const doc = 'See https://example.com/not-just-x-but-y for details.\n';
    const diags = scanProse(doc, '/tmp/url.md');
    expect(diags).toHaveLength(0);
  });

  it('scores a slop document higher than a clean one', () => {
    const slop = analyzeProse(SLOP_DOC, '/tmp/slop.md').metrics.score;
    const clean = analyzeProse(CLEAN_DOC, '/tmp/clean.md').metrics.score;
    expect(slop).toBeGreaterThan(clean);
    expect(slop).toBeGreaterThanOrEqual(25);
  });

  it('emits a bundle error once the score crosses the threshold', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    const bundle = diags.find((d) => d.ruleId === 'prose-slop-bundle');
    expect(bundle?.severity).toBe('error');
  });

  it('does not emit a bundle error when a rule filter is set', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md', { rules: ['no-chatbot-residue'] });
    expect(diags.some((d) => d.ruleId === 'prose-slop-bundle')).toBe(false);
    expect(diags.every((d) => d.ruleId === 'no-chatbot-residue')).toBe(true);
  });

  it('skips fixture and dependency paths', () => {
    expect(scanProse(SLOP_DOC, '/repo/tests/fixtures/doc.md')).toEqual([]);
    expect(scanProse(SLOP_DOC, '/repo/node_modules/pkg/readme.md')).toEqual([]);
  });

  it('reports positions inside the original document', () => {
    const diags = scanProse(SLOP_DOC, '/tmp/doc.md');
    const lineCount = SLOP_DOC.split('\n').length;
    for (const diagnostic of diags) {
      expect(diagnostic.line).toBeGreaterThan(0);
      expect(diagnostic.line).toBeLessThanOrEqual(lineCount);
      expect(diagnostic.column).toBeGreaterThan(0);
    }
  });

  it('counts words and sentences', () => {
    const { metrics } = analyzeProse(CLEAN_DOC, '/tmp/clean.md');
    expect(metrics.words).toBeGreaterThan(30);
    expect(metrics.sentences).toBeGreaterThan(3);
    expect(metrics.paragraphs).toBeGreaterThan(2);
  });
});

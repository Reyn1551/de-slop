import { describe, expect, it } from 'vitest';
import { escapeHtml, htmlReport } from './html';
import type { ReportData } from './html';

const DATA: ReportData = {
  generatedAt: '2026-11-01T00:00:00.000Z',
  target: 'src',
  files: [
    {
      path: 'src/app.ts',
      errors: 1,
      warnings: 1,
      diagnostics: [
        { ruleId: 'no-hardcoded-secret', severity: 'error', message: "Hardcoded secret assigned to 'apiKey'", filePath: 'src/app.ts', line: 4, column: 7 },
        { ruleId: 'no-generic-name', severity: 'warning', message: "Generic identifier 'data'", filePath: 'src/app.ts', line: 9, column: 3 },
      ],
    },
    { path: 'src/clean.ts', errors: 0, warnings: 0, diagnostics: [] },
  ],
  degradation: {
    erosion: 0.412,
    verbosity: 0.031,
    loc: 900,
    files: [
      { filePath: 'src/app.ts', erosion: 0.412, verbosity: 0.031, maxCyclomatic: 14 },
      { filePath: 'src/clean.ts', erosion: 0, verbosity: 0, maxCyclomatic: 2 },
    ],
  },
  packages: [
    { name: 'lodasl', ecosystem: 'npm', verdict: 'typosquat', reasons: ['edit distance 1 from "lodash"'] },
    { name: 'react', ecosystem: 'npm', verdict: 'ok', reasons: [] },
  ],
  testLock: { locked: 3, violations: [{ type: 'assertion-weakened', message: 'src/app.test.ts assertion changed' }] },
  spec: [],
};

describe('htmlReport', () => {
  it('emits a complete document', () => {
    const html = htmlReport(DATA);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('carries no scripts and no external requests', () => {
    const html = htmlReport(DATA);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<img');
  });

  it('counts totals across files, packages, and test-lock', () => {
    // 1 file error + 1 non-ok package + 1 test-lock violation = 3 errors,
    // 1 file warning and nothing else.
    const html = htmlReport(DATA);
    expect(html).toContain('<span class="n error">3</span>');
    expect(html).toContain('<span class="n warning">1</span>');
  });

  it('includes the degradation metrics', () => {
    const html = htmlReport(DATA);
    expect(html).toContain('0.412');
    expect(html).toContain('0.031');
  });

  it('lists risky packages and skips healthy ones', () => {
    const html = htmlReport(DATA);
    expect(html).toContain('lodasl');
    expect(html).toContain('typosquat');
    expect(html).not.toContain('>react<');
  });

  it('renders findings with line and rule', () => {
    const html = htmlReport(DATA);
    expect(html).toContain('4:7');
    expect(html).toContain('no-hardcoded-secret');
    expect(html).toContain('no-generic-name');
  });

  it('skips files with no findings', () => {
    const html = htmlReport(DATA);
    expect(html).not.toContain('src/clean.ts</code></h3>');
  });

  it('escapes message content', () => {
    const hostile: ReportData = {
      ...DATA,
      files: [{
        path: '<img src=x onerror=alert(1)>',
        errors: 1,
        warnings: 0,
        diagnostics: [{
          ruleId: 'xss',
          severity: 'error',
          message: '<script>alert("boom")</script>',
          filePath: 'a',
          line: 1,
          column: 1,
        }],
      }],
    };
    const html = htmlReport(hostile);
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });

  it('handles a report with no degradation', () => {
    const html = htmlReport({ ...DATA, degradation: null });
    expect(html).not.toContain('erosion (human mean');
    expect(html).toContain('</body>');
  });

  it('handles empty input', () => {
    const html = htmlReport({
      generatedAt: 'now',
      target: '.',
      files: [],
      degradation: null,
      packages: [],
      testLock: { locked: 0, violations: [] },
      spec: [],
    });
    expect(html).toContain('de-slop report');
    expect(html).toContain('</html>');
  });
});

describe('escapeHtml', () => {
  it('escapes every html metacharacter', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;');
  });

  it('leaves plain text alone', () => {
    expect(escapeHtml('no findings here')).toBe('no findings here');
  });
});

import type { Diagnostic } from '../slop-scanner/types';

export interface ReportFileEntry {
  path: string;
  diagnostics: Diagnostic[];
  errors: number;
  warnings: number;
}

export interface ReportPackage {
  name: string;
  ecosystem: string;
  verdict: string;
  reasons: string[];
  version?: string;
}

export interface ReportDegradationFile {
  filePath: string;
  erosion: number;
  verbosity: number;
  maxCyclomatic: number;
}

export interface ReportDegradation {
  erosion: number;
  verbosity: number;
  loc: number;
  files: ReportDegradationFile[];
}

export interface ReportData {
  generatedAt: string;
  target: string;
  files: ReportFileEntry[];
  degradation: ReportDegradation | null;
  packages: ReportPackage[];
  testLock: { locked: number; violations: { type?: string; message: string }[] };
  spec: { specPath?: string; violations?: { severity?: string; message: string }[] }[];
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

function totals(data: ReportData): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const file of data.files) {
    errors += file.errors;
    warnings += file.warnings;
  }
  for (const entry of data.packages) {
    if (entry.verdict !== 'ok') errors += 1;
  }
  errors += data.testLock.violations.length;
  for (const spec of data.spec) {
    for (const violation of spec.violations ?? []) {
      if (violation.severity === 'error') errors += 1;
      else warnings += 1;
    }
  }
  return { errors, warnings };
}

function ruleFrequency(data: ReportData): [string, number][] {
  const counts = new Map<string, number>();
  for (const file of data.files) {
    for (const diagnostic of file.diagnostics) {
      counts.set(diagnostic.ruleId, (counts.get(diagnostic.ruleId) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const STYLE = `
:root{color-scheme:light dark;--fg:#1a1a1a;--muted:#5a5a5a;--border:#d8d8d8;--surface:#fafafa;--error:#b3261e;--warning:#8a5a00}
@media (prefers-color-scheme:dark){:root{--fg:#e8e8e8;--muted:#a0a0a0;--border:#3a3a3a;--surface:#161616;--error:#ff8a80;--warning:#ffcf70}}
*{box-sizing:border-box}
body{margin:0 auto;padding:2rem 1.25rem;max-width:70rem;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--fg);background:transparent}
h1{font-size:1.6rem;margin:0 0 .25rem}
h2{font-size:1.15rem;margin:2.5rem 0 .75rem;padding-bottom:.35rem;border-bottom:1px solid var(--border)}
p.meta{margin:0;color:var(--muted);font-size:.875rem}
table{width:100%;border-collapse:collapse;font-size:.875rem;margin:.5rem 0 1rem}
th,td{text-align:left;padding:.45rem .6rem;border-bottom:1px solid var(--border);vertical-align:top}
th{font-weight:600;color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
td.num{text-align:right;font-variant-numeric:tabular-nums}
code{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--surface);padding:.1em .35em;border-radius:3px}
.badge{display:inline-block;padding:.05em .45em;border-radius:3px;font-size:.75rem;font-weight:600;text-transform:uppercase}
.error{color:var(--error)}
.warning{color:var(--warning)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:.75rem;margin:1rem 0}
.card{border:1px solid var(--border);border-radius:6px;padding:.75rem 1rem}
.card .n{display:block;font-size:1.5rem;font-weight:600;font-variant-numeric:tabular-nums}
.card .k{color:var(--muted);font-size:.8rem}
`;

/**
 * Standalone HTML report. No scripts, no external requests: the file opens from
 * disk and renders the same numbers the Markdown report carries. Colors come
 * from the reader's own color scheme, so it stays legible in either theme.
 */
export function htmlReport(data: ReportData): string {
  const { errors, warnings } = totals(data);
  const filesWithFindings = data.files.filter((file) => file.diagnostics.length > 0);
  const risky = data.packages.filter((entry) => entry.verdict !== 'ok');
  const frequency = ruleFrequency(data);

  const parts: string[] = [];
  parts.push('<!doctype html>');
  parts.push('<html lang="en"><head><meta charset="utf-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  parts.push('<title>de-slop report</title>');
  parts.push(`<style>${STYLE}</style>`);
  parts.push('</head><body>');

  parts.push('<h1>de-slop report</h1>');
  parts.push(`<p class="meta">${escapeHtml(data.generatedAt)} &middot; target <code>${escapeHtml(data.target)}</code></p>`);

  parts.push('<div class="cards">');
  parts.push(`<div class="card"><span class="n error">${errors}</span><span class="k">errors</span></div>`);
  parts.push(`<div class="card"><span class="n warning">${warnings}</span><span class="k">warnings</span></div>`);
  parts.push(`<div class="card"><span class="n">${data.files.length}</span><span class="k">files scanned</span></div>`);
  parts.push(`<div class="card"><span class="n">${data.packages.length}</span><span class="k">dependencies</span></div>`);
  if (data.degradation !== null) {
    parts.push(`<div class="card"><span class="n">${data.degradation.erosion.toFixed(3)}</span><span class="k">erosion (human mean 0.34)</span></div>`);
    parts.push(`<div class="card"><span class="n">${data.degradation.verbosity.toFixed(3)}</span><span class="k">verbosity (human mean 0.19)</span></div>`);
  }
  parts.push('</div>');

  if (frequency.length > 0) {
    parts.push('<h2>Rule frequency</h2><table><thead><tr><th>Rule</th><th class="num">Count</th></tr></thead><tbody>');
    for (const [ruleId, count] of frequency) {
      parts.push(`<tr><td><code>${escapeHtml(ruleId)}</code></td><td class="num">${count}</td></tr>`);
    }
    parts.push('</tbody></table>');
  }

  if (filesWithFindings.length > 0) {
    parts.push('<h2>Findings</h2>');
    for (const file of filesWithFindings) {
      parts.push(`<h3><code>${escapeHtml(file.path)}</code></h3>`);
      parts.push('<table><thead><tr><th class="num">Line</th><th>Severity</th><th>Rule</th><th>Message</th></tr></thead><tbody>');
      for (const diagnostic of file.diagnostics) {
        parts.push(
          `<tr><td class="num">${diagnostic.line}:${diagnostic.column}</td>` +
            `<td><span class="badge ${diagnostic.severity}">${diagnostic.severity}</span></td>` +
            `<td><code>${escapeHtml(diagnostic.ruleId)}</code></td>` +
            `<td>${escapeHtml(diagnostic.message)}</td></tr>`,
        );
      }
      parts.push('</tbody></table>');
    }
  }

  if (risky.length > 0) {
    parts.push('<h2>Package gate</h2><table><thead><tr><th>Package</th><th>Ecosystem</th><th>Verdict</th><th>Reasons</th></tr></thead><tbody>');
    for (const entry of risky) {
      parts.push(
        `<tr><td><code>${escapeHtml(entry.name)}</code></td><td>${escapeHtml(entry.ecosystem)}</td>` +
          `<td class="error">${escapeHtml(entry.verdict)}</td><td>${escapeHtml(entry.reasons.join('; '))}</td></tr>`,
      );
    }
    parts.push('</tbody></table>');
  }

  if (data.degradation !== null) {
    const worst = [...data.degradation.files]
      .sort((a, b) => b.erosion - a.erosion)
      .slice(0, 10)
      .filter((file) => file.erosion > 0 || file.verbosity > 0);
    if (worst.length > 0) {
      parts.push('<h2>Degradation</h2><table><thead><tr><th>File</th><th class="num">Erosion</th><th class="num">Verbosity</th><th class="num">Max CC</th></tr></thead><tbody>');
      for (const file of worst) {
        parts.push(
          `<tr><td><code>${escapeHtml(file.filePath)}</code></td>` +
            `<td class="num">${file.erosion.toFixed(3)}</td>` +
            `<td class="num">${file.verbosity.toFixed(3)}</td>` +
            `<td class="num">${file.maxCyclomatic}</td></tr>`,
        );
      }
      parts.push('</tbody></table>');
    }
  }

  if (data.testLock.violations.length > 0) {
    parts.push('<h2>Test-lock violations</h2><ul>');
    for (const violation of data.testLock.violations) {
      parts.push(`<li>${escapeHtml(violation.message)} <span class="badge warning">${escapeHtml(violation.type ?? 'unknown')}</span></li>`);
    }
    parts.push('</ul>');
  }

  parts.push('</body></html>');
  return `${parts.join('\n')}\n`;
}

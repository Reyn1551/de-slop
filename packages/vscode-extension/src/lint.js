const { readFileSync } = require('node:fs');
const { collectRepoFacts, isAgentConfig, scanContextRot, scanContent } = require('@de-slop/core');

/**
 * Pure lint step. Kept separate from the VS Code API so it can be tested
 * without an editor: text in, diagnostics out.
 */
function lintText(text, filePath, facts) {
  const diagnostics = scanContent(text, filePath);

  // Agent instruction files need the repository to answer "does this path
  // still exist". Without facts the three staleness rules stay silent, so the
  // caller passes them when it has them.
  if (facts !== undefined && isAgentConfig(filePath)) {
    diagnostics.push(...scanContextRot(text, filePath, facts));
  }

  return diagnostics;
}

function lintFile(filePath, facts) {
  let code;
  try {
    code = readFileSync(filePath, 'utf8');
  } catch (err) {
    return [{
      ruleId: 'scan-error',
      severity: 'error',
      message: err.message,
      filePath,
      line: 0,
      column: 0,
    }];
  }
  return lintText(code, filePath, facts);
}

/**
 * Build the fact set the staleness rules check against. Expensive: it reads
 * every source file once, so the extension caches the result and rebuilds it
 * only when a save changes a file.
 */
function buildFacts(files, packageJson) {
  const sources = [];
  for (const { filePath, code } of files) sources.push({ filePath, code });
  return collectRepoFacts(sources, packageJson);
}

/**
 * Map a de-slop diagnostic onto the zero-based range VS Code expects.
 * de-slop reports 1-based line and column, with zero for file-level findings,
 * so both ends are clamped.
 */
function toRange(diagnostic) {
  const line = Math.max(0, (diagnostic.line || 1) - 1);
  const character = Math.max(0, (diagnostic.column || 1) - 1);
  return {
    start: { line, character },
    end: { line, character: character + 1 },
  };
}

/** A one-line summary for the status bar. */
function summarize(diagnostics) {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
  if (errors === 0 && warnings === 0) return 'de-slop: clean';
  const parts = [];
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? '' : 's'}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? '' : 's'}`);
  return `de-slop: ${parts.join(', ')}`;
}

/** Files worth linting. Everything else is skipped before a read. */
const LINTABLE = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|css|scss|md|mdx|markdown|txt|rst|adoc)$/i;
const SKIPPED = /(?:^|\/)(?:node_modules|dist|\.git|\.de-slop)\//;

function isLintable(filePath) {
  return LINTABLE.test(filePath) && !SKIPPED.test(filePath);
}

module.exports = { buildFacts, isLintable, lintFile, lintText, summarize, toRange };

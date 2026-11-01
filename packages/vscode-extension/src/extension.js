const vscode = require('vscode');
const { buildFacts, isLintable, lintFile, lintText, summarize, toRange } = require('./lint.js');

const DIAGNOSTIC_SOURCE = 'de-slop';

/** One collection per severity, so the Problems panel can filter them apart. */
function createCollections() {
  return {
    error: vscode.languages.createDiagnosticCollection(`${DIAGNOSTIC_SOURCE}-error`),
    warning: vscode.languages.createDiagnosticCollection(`${DIAGNOSTIC_SOURCE}-warning`),
  };
}

function publish(collections, uri, diagnostics) {
  collections.error.clear();
  collections.warning.clear();

  const bySeverity = { error: [], warning: [] };
  for (const diagnostic of diagnostics) {
    const entry = new vscode.Diagnostic(
      toRange(diagnostic),
      diagnostic.message,
      diagnostic.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
    );
    entry.source = DIAGNOSTIC_SOURCE;
    entry.code = diagnostic.ruleId;
    bySeverity[diagnostic.severity === 'error' ? 'error' : 'warning'].push(entry);
  }

  if (bySeverity.error.length > 0) collections.error.set(uri, bySeverity.error);
  if (bySeverity.warning.length > 0) collections.warning.set(uri, bySeverity.warning);
}

function lintDocument(document, collections, statusItem, facts) {
  if (!isLintable(document.fileName)) return [];
  const diagnostics = lintText(document.getText(), document.fileName, facts);
  publish(collections, document.uri, diagnostics);
  if (statusItem !== undefined) statusItem.text = summarize(diagnostics);
  return diagnostics;
}

/**
 * Build the fact set the agent-instruction rules need, once per workspace.
 * Reading every source file is the expensive part, so the result is cached
 * until a save invalidates it.
 */
const FACT_SOURCE_LIMIT = 5000;

async function workspaceFacts() {
  const uris = await vscode.workspace.findFiles(
    '**/*.{ts,tsx,js,jsx,mjs,cjs}',
    '**/{node_modules,dist,.git,.de-slop}/**',
    FACT_SOURCE_LIMIT,
  );

  const sources = [];
  for (const uri of uris) {
    try {
      const buffer = await vscode.workspace.fs.readFile(uri);
      sources.push({ filePath: vscode.workspace.asRelativePath(uri), code: buffer.toString() });
    } catch {
      continue;
    }
  }

  let packageJson;
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder !== undefined) {
    try {
      packageJson = (await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, 'package.json'))).toString();
    } catch {
      packageJson = undefined;
    }
  }

  return buildFacts(sources, packageJson);
}

function registerDocumentEvents(context, session) {
  const { collections, configuration, lintWithFacts, invalidateFacts } = session;

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (!configuration().get('scanOnSave', true)) return;
      invalidateFacts();
      void lintWithFacts(document);
    }),
  );

  // An edit in a file with findings has to clear stale squiggles, otherwise a
  // fixed problem keeps its underline until the next save.
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!configuration().get('scanOnType', false)) return;
      if (event.contentChanges.length === 0) return;
      void lintWithFacts(event.document);
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      collections.error.delete(document.uri);
      collections.warning.delete(document.uri);
    }),
  );
}

async function scanWorkspace(session) {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    vscode.window.showInformationMessage('de-slop: open a folder first.');
    return;
  }

  const uris = await vscode.workspace.findFiles(
    '**/*.{ts,tsx,js,jsx,mjs,cjs,json,css,scss,md,mdx,markdown,txt,rst,adoc}',
    '**/{node_modules,dist,.git,.de-slop}/**',
  );

  const facts = await session.factsFor().catch(() => undefined);
  let files = 0;
  let errors = 0;
  let warnings = 0;

  for (const uri of uris) {
    const diagnostics = lintFile(uri.fsPath, facts);
    files += 1;
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === 'error') errors += 1;
      else warnings += 1;
    }
    if (diagnostics.length > 0) publish(session.collections, uri, diagnostics);
  }

  session.statusItem.text = summarize([
    ...Array.from({ length: errors }, () => ({ severity: 'error' })),
    ...Array.from({ length: warnings }, () => ({ severity: 'warning' })),
  ]);

  const message = `de-slop: scanned ${files} files, ${errors} errors, ${warnings} warnings`;
  if (errors > 0) vscode.window.showWarningMessage(message);
  else vscode.window.showInformationMessage(message);
}

function activate(context) {
  const collections = createCollections();
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusItem.command = 'de-slop.scanWorkspace';
  statusItem.show();
  context.subscriptions.push(collections.error, collections.warning, statusItem);

  const configuration = () => vscode.workspace.getConfiguration('de-slop');

  let factsPromise = null;
  const factsFor = () => {
    if (!configuration().get('checkAgentInstructions', true)) return Promise.resolve(undefined);
    factsPromise ??= workspaceFacts().catch(() => undefined);
    return factsPromise;
  };

  const session = {
    collections,
    statusItem,
    configuration,
    invalidateFacts: () => {
      factsPromise = null;
    },
    factsFor,
    lintWithFacts: async (document) => {
      const facts = await factsFor();
      return lintDocument(document, collections, statusItem, facts);
    },
  };

  registerDocumentEvents(context, session);

  context.subscriptions.push(
    vscode.commands.registerCommand('de-slop.scanFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined) {
        vscode.window.showInformationMessage('de-slop: open a file first.');
        return;
      }
      const facts = await factsFor();
      const diagnostics = lintDocument(editor.document, collections, statusItem, facts);
      vscode.window.showInformationMessage(summarize(diagnostics));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('de-slop.scanWorkspace', () => scanWorkspace(session)),
  );

  const editor = vscode.window.activeTextEditor;
  if (editor !== undefined) void session.lintWithFacts(editor.document);
}

function deactivate() {
  // Collections and the status item are disposed through context.subscriptions.
}

module.exports = { activate, deactivate };

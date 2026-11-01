const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

/**
 * Load the extension with a stub `vscode` module. VS Code cannot run here, so
 * this is the closest thing to proof that activate() wires everything up: the
 * stub records every registration and throws on a misspelled API.
 */
function loadExtension() {
  const registered = { commands: [], subscriptions: [], collections: {}, statusItem: null };
  const diagnosticsSets = [];

  const disposable = () => ({ dispose() {} });

  const vscode = {
    StatusBarAlignment: { Left: 1, Right: 2 },
    DiagnosticSeverity: { Error: 0, Warning: 1 },
    Diagnostic: class {
      constructor(range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
      }
    },
    Uri: { joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts), ...uri }) },
    window: {
      createStatusBarItem: () => {
        registered.statusItem = { text: '', command: '', show() {}, dispose() {} };
        return registered.statusItem;
      },
      showInformationMessage: () => {},
      showWarningMessage: () => {},
      activeTextEditor: undefined,
    },
    workspace: {
      getConfiguration: () => ({
        get: (key, fallback) => {
          const values = { scanOnSave: true, scanOnType: false, checkAgentInstructions: false };
          return key in values ? values[key] : fallback;
        },
      }),
      onDidSaveTextDocument: (handler) => {
        registered.saveHandler = handler;
        return disposable();
      },
      onDidChangeTextDocument: (handler) => {
        registered.changeHandler = handler;
        return disposable();
      },
      onDidCloseTextDocument: (handler) => {
        registered.closeHandler = handler;
        return disposable();
      },
      findFiles: async () => [],
      asRelativePath: (uri) => uri.fsPath,
      fs: { readFile: async () => Buffer.from('') },
      workspaceFolders: [],
    },
    languages: {
      createDiagnosticCollection: (name) => {
        const collection = {
          name,
          entries: new Map(),
          set(uri, entries) {
            this.entries.set(uri.toString(), entries);
            diagnosticsSets.push({ name, uri, entries });
          },
          clear() {
            this.entries.clear();
          },
          delete(uri) {
            this.entries.delete(uri.toString());
          },
          dispose() {},
        };
        registered.collections[name] = collection;
        return collection;
      },
    },
    commands: {
      registerCommand: (id, handler) => {
        registered.commands.push({ id, handler });
        return disposable();
      },
    },
  };

  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (request === 'vscode') return vscode;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const extensionPath = path.join(__dirname, '..', 'src', 'extension.js');
    delete require.cache[require.resolve(extensionPath)];
    return { extension: require(extensionPath), registered, vscode };
  } finally {
    Module._load = originalLoad;
  }
}

test('activate registers both commands and both collections', () => {
  const { extension, registered } = loadExtension();
  const context = { subscriptions: [] };
  extension.activate(context);

  const ids = registered.commands.map((command) => command.id);
  assert.deepEqual(ids.sort(), ['de-slop.scanFile', 'de-slop.scanWorkspace']);
  assert.ok(registered.collections['de-slop-error']);
  assert.ok(registered.collections['de-slop-warning']);
  assert.ok(registered.statusItem !== null);
  assert.ok(context.subscriptions.length > 0);
});

test('activate subscribes to save, change, and close', () => {
  const { extension, registered } = loadExtension();
  extension.activate({ subscriptions: [] });
  assert.equal(typeof registered.saveHandler, 'function');
  assert.equal(typeof registered.changeHandler, 'function');
  assert.equal(typeof registered.closeHandler, 'function');
});

test('saving a file publishes diagnostics to the right collection', async () => {
  const { extension, registered } = loadExtension();
  extension.activate({ subscriptions: [] });

  registered.saveHandler({
    fileName: 'src/config.ts',
    getText: () => 'const apiKey = "sk-live-abcdef";\n',
    uri: { toString: () => 'file:///src/config.ts' },
  });
  // The save handler awaits the fact set before linting, so let it settle.
  await new Promise((resolve) => setImmediate(resolve));

  const errors = registered.collections['de-slop-error'].entries.get('file:///src/config.ts');
  assert.ok(errors && errors.length > 0, 'expected an error diagnostic');
  assert.equal(errors[0].source, 'de-slop');
  assert.equal(errors[0].code, 'no-hardcoded-secret');
});

test('saving a clean file leaves the collections empty', async () => {
  const { extension, registered } = loadExtension();
  extension.activate({ subscriptions: [] });
  registered.saveHandler({
    fileName: 'src/clean.ts',
    getText: () => '/** Doubles. */\nexport function twice(n: number) { return n * 2; }\n',
    uri: { toString: () => 'file:///src/clean.ts' },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registered.collections['de-slop-error'].entries.size, 0);
});

test('saving an unparseable file reports scan-error rather than throwing', () => {
  const { extension, registered } = loadExtension();
  extension.activate({ subscriptions: [] });
  assert.doesNotThrow(() => {
    registered.saveHandler({
      fileName: 'src/broken.ts',
      getText: () => 'const x = ;',
      uri: { toString: () => 'file:///src/broken.ts' },
    });
  });
});

test('closing a file clears both collections for it', async () => {
  const { extension, registered } = loadExtension();
  extension.activate({ subscriptions: [] });
  const uri = { toString: () => 'file:///src/config.ts' };
  registered.saveHandler({
    fileName: 'src/config.ts',
    getText: () => 'const apiKey = "sk-live-abcdef";\n',
    uri,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(registered.collections['de-slop-error'].entries.size > 0);
  registered.closeHandler({ uri });
  assert.equal(registered.collections['de-slop-error'].entries.size, 0);
  assert.equal(registered.collections['de-slop-warning'].entries.size, 0);
});

test('the status bar shows a summary after a save', async () => {
  const { extension, registered } = loadExtension();
  extension.activate({ subscriptions: [] });
  registered.saveHandler({
    fileName: 'src/config.ts',
    getText: () => 'const apiKey = "sk-live-abcdef";\n',
    uri: { toString: () => 'file:///src/config.ts' },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(registered.statusItem.text, /^de-slop: \d+ errors?/);
});

test('the scanFile command reports when no editor is open', async () => {
  const { extension, registered } = loadExtension();
  extension.activate({ subscriptions: [] });
  const command = registered.commands.find((entry) => entry.id === 'de-slop.scanFile');
  await assert.doesNotReject(command.handler());
});

test('the scanWorkspace command reports when no folder is open', async () => {
  const { extension, registered } = loadExtension();
  extension.activate({ subscriptions: [] });
  const command = registered.commands.find((entry) => entry.id === 'de-slop.scanWorkspace');
  await assert.doesNotReject(command.handler());
});

test('deactivate is safe to call', () => {
  const { extension } = loadExtension();
  assert.doesNotThrow(() => extension.deactivate());
});

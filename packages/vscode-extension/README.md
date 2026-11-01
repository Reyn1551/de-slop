# de-slop for VS Code

Diagnostics in the editor from the same engine the CLI runs: code slop, runtime
risks, agent-guard, design tells, accessibility, prose, agent instructions, and
MCP configs.

## Install

The extension is not on the Marketplace yet. Load it from a checkout:

```bash
npm install
npm run build
npm run test:extension
```

Then in VS Code: **Extensions: Install from VSIX** after packing, or open this
folder in VS Code and press F5 to run the Extension Development Host.

To pack:

```bash
npx @vscode/vsce package --no-dependencies --out de-slop.vsix
code --install-extension de-slop.vsix
```

## What it does

- Lints a file on save and publishes findings to the Problems panel.
- Shows a status-bar summary: `de-slop: 2 errors, 5 warnings`, or `clean`.
- Adds two commands: **de-slop: Scan current file** and **de-slop: Scan
  workspace**.

Settings:

| Setting | Default | Effect |
|---|---|---|
| `de-slop.scanOnSave` | `true` | Scan the saved file |
| `de-slop.scanOnType` | `false` | Scan while typing; the scanner parses an AST per change, so this is off |
| `de-slop.checkAgentInstructions` | `true` | Check AGENTS.md and friends for stale paths and scripts; reads the workspace once and caches the fact set |

Findings clear when a file closes, so a fixed problem does not keep its
underline.

## Why there is no bundled engine

The extension calls `@de-slop/core` from the workspace. That keeps one copy of
the rules for the CLI, MCP server, GitHub Action, and editor, so a rule cannot
behave differently depending on where it runs.

## Layout

```
src/lint.js        text in, diagnostics out; no editor API, so it is testable
src/extension.js   VS Code wiring: collections, status bar, commands, events
test/lint.test.js        18 tests against the lint step
test/extension.test.js   10 tests that activate() with a stubbed vscode module
```

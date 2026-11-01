# MCP Integration

The MCP server lets an editor (Cursor, Claude Code, Windsurf, Cline) call
de-slop's detectors directly, so an agent can check its own output before it
finishes.

## Setup

```bash
npx de-slop mcp
```

## Client config

```json
{
  "mcpServers": {
    "de-slop": {
      "command": "npx",
      "args": ["-y", "de-slop", "mcp"]
    }
  }
}
```

## Tools

| Tool | Input | Returns |
|---|---|---|
| `check_slop` | `code` or `paths`, optional `filename`, `rules` | Every detector's diagnostics, picked by file extension |
| `check_prose` | `text` or `path`, optional `rules` | Diagnostics plus a 0-100 score and word counts |
| `check_ux` | `text` or `path`, optional `rules` | Accessibility diagnostics |
| `check_degradation` | `files`, optional `baseline` | Erosion, verbosity, and a delta against the baseline |
| `check_context_rot` | `content`, `path`, `files`, optional `packageJson` | Stale paths, symbols, and scripts in an instruction file |
| `check_design_contract` | `content`, `path`, `files`, optional `minimumOccurrences` | Parsed contract plus drift diagnostics for values it never declares |
| `verify_tests` | `path`, optional `storePath` | Violations against the locked fingerprint |
| `check_package` | `name`, `ecosystem` | Verdict: `ok`, `suspicious`, `not-found`, `unknown`, `typosquat` |
| `spec_verify` | `specPath`, `sourceGlobs` | Spec violations |

`check_slop` is the one to call in a loop: pass the file you just wrote and the
filename, and the extension decides whether the AST, accessibility, or prose
rules run.

## Agent loop

A working pattern for an agent that edits code:

1. Write or change a file.
2. Call `check_slop` with that file's content and path.
3. Fix every `error`. Read each `warning` and decide.
4. Before claiming done, call `check_degradation` with the changed files and the
   versions from before the edit. A rising erosion score means the change
   concentrated complexity instead of adding a function.

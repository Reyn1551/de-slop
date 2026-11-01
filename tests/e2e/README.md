# End-to-end tests

These run the real binaries through `execFileSync`, so a passing unit test that
never touched a file cannot hide a broken command.

| File | Covers |
|---|---|
| `cli.e2e.test.ts` | `check` on the slop and clean fixtures, `--rules` filtering, exit codes, `fix`, `init` in a temp git repo, `prose`, `budget` save and regression, test-lock verify |
| `mcp.e2e.test.ts` | The MCP server over stdio via the SDK client: tool list and every tool call |
| `action.e2e.test.ts` | The GitHub Action runtime against both fixtures |

Fixtures live in `../fixtures/`. Temp directories are created per test and
removed at the end, so a run leaves the repository untouched.

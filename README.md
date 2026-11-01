# de-slop

Guardrails for repositories where an agent writes most of the code. It reads a
file, builds an AST, and reports the failure modes that pass CI while the
product breaks.

Run it before you trust a green build.

```bash
npx de-slop init          # config, test-lock store, pre-commit hook
npx de-slop init --design # plus a DESIGN.md contract template
npx de-slop check .       # every detector, exit 1 on error
npx de-slop fix .         # rewrite the fixable findings
npx de-slop prose docs/   # score documentation for AI writing tells
npx de-slop budget .      # erosion and verbosity against a baseline
npx de-slop context .     # agent instructions vs the repo
npx de-slop rules         # every rule, or --write docs/RULES.md
npx de-slop commit        # commit message vs staged diff
npx de-slop intercept 'npm install <pkg>'
npx de-slop mcp           # stdio MCP server
```

## What it catches

| Module | Detects | Rules |
|---|---|---|
| `slop-scanner` | Code slop and security defects: comments that restate the next line, dead branches, wrapper functions, generic names, hardcoded secrets, injection sinks, unsafe `innerHTML`, unresolved imports | 17 |
| `runtime-guard` | Unhandled promises, missing cleanup for timers and listeners, unguarded null access | 4 |
| `agent-guard` | Prompt injection, invisible unicode, secret logging, destructive commands, unsafe install instructions | 7 |
| `design-slop` | AI design tells: indigo-to-purple gradients, glass on every surface, glow shadows, gradient blobs, hero pills, emoji icons, single-font pages, grey-on-dark contrast | 11 |
| `design-contract` | Drift from a declared DESIGN.md: values used repeatedly but never declared, plus exemptions for tokens the project did choose | 3 dimensions |
| `ux-guard` | Provable accessibility failures: missing alt text, unlabeled icon buttons, removed focus rings, placeholder-only labels, blocked zoom, 44px touch targets, motion without reduced-motion, off-grid spacing | 12 |
| `prose-slop` | AI writing tells: not-X-but-Y contrasts, staged openers, chatbot residue, inflated significance, fake depth, sales language, AI vocabulary, dash overload, bold-label lists, closers | 14 |
| `context-rot` | Agent instructions pointing at files, symbols, or scripts that no longer exist, plus instruction quality: line budget, generic advice, pasted trees, duplicates | 8 |
| `mcp-guard` | MCP client configs: plaintext transport, literal secrets, unpinned launches, typosquatted packages, dangerous auto-approval | 5 |
| `commit-guard` | Commit and PR messages that contradict their diff: a named file or symbol the change never touched, a test claim with no test, a subject naming nothing | 8 |
| `test-lock` | Test files rewritten to pass: removed tests, skipped cases, weakened assertions, happy-path-only coverage | fingerprint |
| `package-gate` | Slopsquatting: missing packages, brand-new packages, typosquats within one edit of a popular name, install scripts that pipe to a shell | registry + corpus |
| `spec-contractor` | Spec drift: declared functions missing, invariants violated | contract |
| `circuit-breaker` | Doom loops: repeated identical attempts, tool-call budget, diff-line budget | state machine |
| `degradation` | Quality decay across iterations: structural erosion, verbosity, compared against a stored baseline | 2 metrics |
| `ast-pruner` | Context rot from reading whole files: prunes to the declarations a query needs | pruner |
| `report` | Markdown, JSON, and standalone HTML output for `de-slop report` | renderer |

Severity policy: `error` is a provable defect (failing test, missing package,
XSS, WCAG failure, chatbot residue in published docs). `warning` is a pattern
that needs a human decision. Only errors fail the build unless `--strict` is
set.

The counts above are patterns. `de-slop rules` lists 94 ids, including the
aggregate verdicts a module emits once per file (a design bundle, a prose
score, an unparseable MCP config, an empty commit message). `docs/RULES.md`
carries the full list.

## Research this is built on

- SlopCodeBench (arXiv:2603.24755): agent code is 2.3x more verbose and 2.0x more
  eroded than 473 human repositories, and erosion rises in 77% of trajectories.
  `degradation` implements its two metrics verbatim, with the human means
  (0.34 erosion, 0.19 verbosity) as the default ceiling.
- Context rot (arXiv:2606.09090): stale code references appear in 23% of sampled
  repositories. `context-rot` ports that check to `AGENTS.md` and friends.
- Slopsquatting (arXiv:2608.23897, CSA 2026-04-19): half of flagged
  hallucinations are registered packages that imitate a real one. `package-gate`
  checks edit distance, not only existence.
- Wikipedia "Signs of AI writing" (via the humanizer skill): the 26 prose tells.
  `prose-slop` implements 14 of them deterministically.
- Message-code inconsistency (arXiv:2601.04886): across 23,247 agentic PRs, the
  1.7% whose descriptions claimed changes the diff never made had a 51.7% lower
  acceptance rate and took 3.5x longer to merge. `commit-guard` checks that
  claim against the diff.
- ui-ux-pro-max's 119 UX guidelines: the WCAG 2.2 and Apple HIG thresholds.
  `ux-guard` implements 12 as static checks.

## Configuration

`.desloprc.json`, read from the nearest ancestor:

```json
{
  "exclude": ["vendor", "tests/fixtures"],
  "rules": [],
  "prose": [],
  "ux": [],
  "strict": false,
  "budget": { "tolerance": 0.02, "ceiling": false, "baseline": ".de-slop/baseline.json" }
}
```

Empty `rules` / `prose` / `ux` means every rule. `exclude` entries match a
directory name or a repo-relative path.

## MCP integration

```json
{
  "mcpServers": { "de-slop": { "command": "npx", "args": ["-y", "de-slop", "mcp"] } }
}
```

Eleven tools: `check_slop`, `check_prose`, `check_ux`, `check_degradation`,
`check_context_rot`, `check_design_contract`, `check_mcp_config`,
`check_commit_message`, `verify_tests`, `check_package`, `spec_verify`. `check_slop` runs every detector
and picks them by extension; the rest target one concern each.

## GitHub Action

```yaml
- uses: Reyn1551/de-slop/packages/action@main
  with:
    command: check
    paths: .
```

`de-slop init --ci` writes the workflow. `de-slop init --mcp cursor|claude`
writes the client config.

## Development

```bash
npm run build       # tsc core + mcp-server into dist
npm test            # vitest, 535 tests
npm run test:extension  # node:test, 28 tests
npm run typecheck   # tsc --noEmit
```

The repo uses `typescript@7` (native tsgo), so `ts.createSourceFile` does not
exist. Every AST module goes through `packages/core/src/slop-scanner/ts-api.ts`.
See `docs/ARCHITECTURE.md`.

## License

MIT

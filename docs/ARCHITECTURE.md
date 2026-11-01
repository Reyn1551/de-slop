# Architecture

## Shape

```
Entrypoints                  Engine                      Output
───────────                  ──────                      ──────
CLI (bin/de-slop.js)  ─┐
MCP server (stdio)    ─┼─→  @de-slop/core  ─→  Diagnostic[] { ruleId, severity,
GitHub Action         ─┘     (12 modules)        message, filePath, line, column }
```

Every entrypoint is an adapter. Detection lives in core, so the CLI, the MCP
server, and the action cannot report different results for the same file.

## Detector fan-out

`packages/core/src/scan.ts` owns the routing. One function decides which
detectors run for a file:

```ts
scanContent(code, filePath, options) → Diagnostic[]
```

| Extension | Detectors |
|---|---|
| `.ts .tsx .js .jsx .mjs .cjs .json` | slop-scanner, runtime-guard, agent-guard, design-slop |
| `.tsx .jsx .html .vue .svelte .astro .css` | + ux-guard |
| `.md .mdx .txt .rst .adoc` | agent-guard, design-slop, prose-slop |

A detector that throws becomes one `scan-error` diagnostic. The other detectors
still report, so one unparseable file does not hide the rest of the run.

## Modules

| Module | Entry | Kind |
|---|---|---|
| `slop-scanner` | `scanSource`, `rules`, `applyFixes` | AST, 17 rules |
| `runtime-guard` | `guardSource` | AST, 4 rules |
| `agent-guard` | `agentGuardScan` | AST + text, 7 rules |
| `design-slop` | `scanDesignSlop` | regex over JSX/CSS, 11 rules + bundle |
| `ux-guard` | `scanUx` | regex over JSX/HTML/CSS, 12 rules |
| `prose-slop` | `scanProse`, `analyzeProse` | text, 14 rules + score |
| `context-rot` | `scanContextRot`, `collectRepoFacts` | text against repo facts, 4 rules |
| `degradation` | `analyzeFile`, `analyzeProject`, `compareBaseline` | AST metrics |
| `test-lock` | `lockTestFile`, `verifyTestFile` | AST fingerprint |
| `spec-contractor` | `runSpecCheck` | YAML subset + AST |
| `package-gate` | `checkPackage`, `findTyposquat` | registry + edit distance |
| `circuit-breaker` | `CircuitBreaker` | state machine |
| `ast-pruner` | `pruneSource` | AST |

## Parser bridge

`typescript@7` is native tsgo. The classic API (`ts.createSourceFile`) is gone.
Every AST module imports `packages/core/src/slop-scanner/ts-api.ts`, which
`require`s `typescript/unstable/ast`, `typescript/unstable/fs`, and
`typescript/unstable/sync` and exposes a virtual filesystem.

`parseSourceFile(code, filePath)` writes the source into that virtual FS under a
ring of 512 slots, then reads the `SourceFile` back from a snapshot. The ring
exists because an MCP server runs for a whole session: without it the virtual FS
grows with every file scanned. A `SourceFile` materializes its text on creation,
so reusing a slot cannot corrupt an earlier result.

Rules are written in the classic style (`ast.isX`, `SyntaxKind`,
`forEachChild`), so porting to a different parser means replacing `ts-api.ts`
and nothing else.

## Adding a rule

Each module has a registry object in its `index.ts`:

```ts
export const PROSE_SLOP_RULES = {
  'no-not-x-but-y': noNotXButY,
  // ...
} as const;
```

A new rule is one file plus one registry line. Rule ids are also the `--rules`
filter and the key in the report's frequency table, so an id must be unique
across modules. When two modules need the same concept, they get different ids:
`no-pill-class-string` (a class name in a string) is not `no-hero-pill` (a pill
element above a heading).

## Self-exemption

`design-slop`, `ux-guard`, and `prose-slop` return nothing for paths that hold
their own fixtures, because a fixture contains broken markup on purpose. The
pattern is the same in each module:

```ts
if (/\/(?:test|tests|__tests__|fixtures?|e2e)\//.test(filePath)) return [];
```

`no-magic-string` and `no-debug-logging` follow the same policy for test files
and CLI output paths.

## Budget and baselines

`degradation` implements SlopCodeBench's two metrics:

```
mass(f)    = cyclomatic(f) × sqrt(sloc(f))
erosion    = Σ mass(f) for cyclomatic > 10  ÷  Σ mass(f)
verbosity  = |{flagged lines} ∪ {clone lines}| ÷ LOC
```

`de-slop budget --save` writes `.de-slop/baseline.json`. Later runs compare
against it and fail when erosion or verbosity grows past `tolerance` (default
0.02), or past the published human means with `--ceiling`.

## Package layout

| Package | Role |
|---|---|
| `@de-slop/core` | every detector, built to `dist/` as CommonJS |
| `de-slop` (CLI) | ESM, no build step, imports core from `dist` |
| `@de-slop/mcp-server` | stdio MCP, 8 tools |
| `packages/action` | node20 JS action, builds core then runs the CLI |

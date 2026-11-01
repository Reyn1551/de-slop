# Roadmap

## v0.1: Foundation

- [x] Monorepo scaffold (TS7/tsgo, vitest, workspaces)
- [x] `slop-scanner` AST rules + auto-fix
- [x] CLI `init`, `check`, `fix`, `mcp`, `intercept`
- [x] GitHub Action, node20 JS runtime

## v0.2: Protection

- [x] `test-lock` AST fingerprinting
- [x] `package-gate` registry validation
- [x] `runtime-guard` edge-case rules
- [x] Pre-commit hook, AI co-author trailer block
- [x] `circuit-breaker` budgets
- [x] `spec-contractor`, `ast-pruner`

## v0.3: AI integration

- [x] MCP server (stdio)
- [x] `agent-guard`: 7 security rules
- [x] `design-slop`: 11 rules + Krebs bundle verdict
- [x] Assertion-quality checks, install-script scanning

## v0.4: Depth

- [x] `prose-slop`: 14 rules over documentation, 0-100 score, bundle error
- [x] `ux-guard`: 12 WCAG 2.2 / HIG rules over JSX, HTML, CSS
- [x] `degradation`: SlopCodeBench erosion and verbosity, baseline compare
- [x] `context-rot`: agent instruction files checked against the repo
- [x] `package-gate`: typosquat verdict via Damerau-Levenshtein
- [x] `design-contract`: DESIGN.md parser, exemptions, and drift detection
- [x] `scanContent`: one detector fan-out shared by CLI, MCP, and action
- [x] CLI `prose`, `budget`, `context`; `--design-md` on `check`
- [x] MCP `check_prose`, `check_ux`, `check_degradation`, `check_context_rot`,
      `check_design_contract`

## v0.5: Correctness pass

Rule quality matters more than rule count. The work here removes false
positives that made the tool noisy on its own source.

- [x] `design-slop`: dark-grey text scoped to its dark region, not file-global
- [x] `design-slop`: purple escalates only on a real gradient
- [x] `design-slop`: gradient buttons scoped to button elements
- [x] `design-slop`: blob animation checked per element
- [x] `design-slop`: glassmorphism uses element and selector structure
- [x] `design-slop`: single-font detection counts declared families
- [x] `design-slop`: glow shadows excluded by class token
- [x] `slop-scanner`: `no-hero-pill` renamed `no-pill-class-string` (id collision)
- [x] `slop-scanner`: `no-missing-docs` limited to exported functions and classes
- [x] `slop-scanner`: `no-magic-string` requires a real TLD, skips tests
- [x] `runtime-guard`: exact nullable method names, declared async callees only
- [x] Parser bridge: virtual FS slots wrap at 512

## Next

- [ ] Publish `@de-slop/cli` to npm
- [ ] VS Code extension
- [ ] `de-slop report` HTML output
- [ ] Per-rule documentation pages

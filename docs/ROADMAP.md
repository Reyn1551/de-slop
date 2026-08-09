# Roadmap

## v0.1 — Foundation
- [x] Monorepo scaffold
- [x] `slop-scanner` rules dasar (6 rules)
- [x] CLI `init` + `check` + `fix` + `mcp` + `intercept`
- [x] GitHub Action manifest (`packages/action/action.yml`)
- [x] Build infra (TS7/tsgo, vitest, workspaces)

## v0.2 — Protection
- [x] `test-lock` AST fingerprinting
- [x] `package-gate` registry validation (npm/pypi)
- [x] `runtime-guard` edge-case rules
- [x] Pre-commit hooks (`de-slop init`)
- [x] `circuit-breaker` untuk agent loops
- [x] Templates distribusi (`de-slop init --ci --mcp` → GitHub Action workflow + Cursor/Claude MCP config)

## v0.3 — AI Integration
- [x] MCP server + tools (check_slop, verify_tests, check_package, spec_verify)
- [x] `spec-contractor` engine
- [x] `ast-pruner` context compaction
- [x] E2E tests penuh untuk MCP tools (SDK client, 4 tools)
- [ ] VS Code extension

## v1.0 — Release
- [ ] Publish `@de-slop/cli` ke npm
- [x] GitHub Action runtime (node20 JS action real, self-contained, auto-build)
- [x] Integrasi install intercept (`de-slop intercept`, CLI wrapper di atas `package-gate`)
- [ ] Dokumentasi publik lengkap

# Roadmap

## v0.1 — Foundation
- [x] Monorepo scaffold
- [x] `slop-scanner` rules dasar (6 rules)
- [x] CLI `init` + `check` + `fix` + `mcp`
- [x] GitHub Action manifest (`packages/action/action.yml`)
- [x] Build infra (TS7/tsgo, vitest, workspaces)

## v0.2 — Protection
- [x] `test-lock` AST fingerprinting
- [x] `package-gate` registry validation (npm/pypi)
- [x] `runtime-guard` edge-case rules
- [x] Pre-commit hooks (`de-slop init`)
- [x] `circuit-breaker` untuk agent loops
- [ ] Templates (.cursorrules, AGENTS.md) — AGENTS.md repo ada, template distribusi belum

## v0.3 — AI Integration
- [x] MCP server + tools (check_slop, verify_tests, check_package, spec_verify)
- [x] `spec-contractor` engine
- [x] `ast-pruner` context compaction
- [ ] E2E tests penuh untuk MCP tools
- [ ] VS Code extension

## v1.0 — Release
- [ ] Publish `@de-slop/cli` ke npm
- [ ] GitHub Action runtime (JS action real, bukan cuma manifest)
- [ ] Integrasi install intercept (`package-gate` hook di npm lifecycle)
- [ ] Dokumentasi publik lengkap

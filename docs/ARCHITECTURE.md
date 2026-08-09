# Architecture — de-slop Monorepo

## Overview

```
┌─────────────────────────────────────────────┐
│                  Entrypoints                │
│  CLI (npx de-slop) │ MCP Server │ GH Action │
└────────┬──────────────┬────────────┬────────┘
         │              │            │
         └──────────────┼────────────┘
                        ▼
              ┌───────────────────┐
              │   @de-slop/core   │
              ├───────────────────┤
              │ test-lock         │
              │ spec-contractor   │
              │ slop-scanner      │
              │ package-gate      │
              │ circuit-breaker   │
              │ runtime-guard     │
              │ ast-pruner        │
              └───────────────────┘
```

## Packages

| Package | Deskripsi |
|---|---|
| `@de-slop/cli` | CLI entrypoint (`init`, `check`, `fix`, `mcp`) |
| `@de-slop/core` | Mesin utama — semua modul analisis |
| `@de-slop/mcp-server` | MCP tools untuk Cursor/Claude Code |
| `de-slop-action` | GitHub Action resmi |

## Prinsip
- **Semua logika di core** — CLI/MCP/Action hanya adapter.
- **AST-first** — analisis berbasis AST, bukan regex.
- **Zero-config default** — jalan tanpa konfigurasi, bisa di-override.

## Modul Core

| Modul | API | Fungsi |
|---|---|---|
| `slop-scanner` | `scanSource`, `applyFixes`, `rules` | 12 rules AST anti-slop (redundant comment, dead code, over-wrapper, unused var, empty catch, hardcoded secret, generic name, injection risk, unresolved import, sycophancy, accept-all, missing docs) |
| `test-lock` | `lockTestFile`, `verifyTestFile`, `fingerprintTests` | Fingerprint sha256 AST test file; deteksi test dihapus/di-skip/assertion dilemahkan/dimocking berlebihan |
| `package-gate` | `checkPackage`, `checkPackages`, `parseInstallCommand` | Validasi umur + downloads package (npm/pypi) untuk anti-slopsquatting |
| `circuit-breaker` | `CircuitBreaker`, `countChangedLines`, `saveState` | Budget retry/tool-calls/diff-lines untuk hentikan doom loop agen |
| `runtime-guard` | `guardSource` | 3 rules edge-case: require-cleanup, floating-promise, unhandled-null |
| `spec-contractor` | `runSpecCheck`, `parseSpecFile`, `verifySpec` | Tegakkan kontrak spec-driven (missing function + invariants) |
| `ast-pruner` | `pruneSource`, `pruneFiles` | Ringkas file ke deklarasi relevan query untuk cegah context rot |

## MCP Tools (packages/mcp-server, stdio via @modelcontextprotocol/sdk)
`check_slop`, `verify_tests`, `check_package`, `spec_verify` — masing-masing bungkus modul core di atas.

## Parser Bridge (wajib dipahami)
`typescript@7.0.2` adalah native (tsgo). API klasik `ts.createSourceFile` tidak ada. Semua modul AST memakai bridge `packages/core/src/slop-scanner/ts-api.ts` yang me-`require('typescript/unstable/ast')` + `typescript/unstable/sync` + virtual FS. Rule ditulis gaya klasik (`ast.isX`, `SyntaxKind`, `forEachChild`) sehingga port nanti tinggal ganti import.

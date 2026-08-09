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

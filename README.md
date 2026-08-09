# de-slop

Anti AI-slop toolkit untuk era vibe coding. Guardrail multi-lapis yang melindungi codebase dari masalah umum kode hasil AI: test yang ditulis ulang agar lolos, spec drift, slopsquatting, infinite retry loops, dan boilerplate slop.

## Quick Start

```bash
npx de-slop init     # setup .desloprc.json + pre-commit hook
npx de-slop check    # scan AI slop, exit 1 jika ada error
npx de-slop fix      # auto-fix yang aman
npx de-slop mcp      # MCP server untuk Cursor/Claude Code
npx de-slop intercept 'npm install <pkg>'   # cek package sebelum install (anti slopsquatting)
```

## Modul

| Modul | Fungsi |
|---|---|
| `slop-scanner` | 6 rules AST linter untuk pola AI slop (redundant comment, dead code, unused var, hardcoded secret, dll) |
| `test-lock` | Kunci unit test via AST fingerprint sha256 — AI tidak bisa mengubah/melemahkan test diam-diam |
| `spec-contractor` | Tegakkan kontrak spec-driven development (missing function + invariants) |
| `package-gate` | Firewall anti-slopsquatting (validasi umur + downloads package sebelum install) |
| `circuit-breaker` | Hentikan infinite doom loop agen AI (budget retry/tool-calls/diff) |
| `runtime-guard` | Validasi edge-cases & memory leaks (floating promise, unhandled null, cleanup) |
| `ast-pruner` | Ringkas file ke deklarasi relevan untuk cegah context rot |

## Integrasi MCP

```json
{
  "mcpServers": {
    "de-slop": { "command": "npx", "args": ["de-slop", "mcp"] }
  }
}
```

Tools: `check_slop`, `verify_tests`, `check_package`, `spec_verify`.

## GitHub Action

```yaml
- uses: de-slop/action@v1
  with:
    command: check
    paths: .
```

Node20 JS action self-contained — auto-build core, tanpa dependensi tambahan. `de-slop init --ci` menulis workflow ini otomatis. `de-slop init --mcp cursor|claude` menulis config MCP server.

## Development

```bash
npm run build       # compile core + mcp-server ke dist
npm test            # vitest (129 tests)
npm run typecheck   # tsc --noEmit
```

Catatan: repo pakai `typescript@7` (native tsgo). Analisis AST lewat bridge `ts-api.ts` (lihat `docs/ARCHITECTURE.md`).

Lihat `docs/` untuk arsitektur, taksonomi masalah, dan roadmap.

## License

MIT

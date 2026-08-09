# de-slop

Anti AI-slop toolkit untuk vibe coding era. Melindungi codebase dari masalah umum kode hasil AI: test yang ditulis ulang agar lolos, spec drift, slopsquatting, infinite retry loops, dan boilerplate slop.

## Quick Start

```bash
npx de-slop init     # setup di proyekmu
npx de-slop check    # scan AI slop
npx de-slop fix      # auto-fix
npx de-slop mcp      # MCP server untuk Cursor/Claude Code
```

## Modul

| Modul | Fungsi |
|---|---|
| `test-lock` | Kunci unit test via AST fingerprint — AI tidak bisa ubah test diam-diam |
| `spec-contractor` | Tegakkan kontrak spec-driven development |
| `slop-scanner` | AST linter untuk pola AI slop |
| `package-gate` | Firewall anti-slopsquatting (validasi package sebelum install) |
| `circuit-breaker` | Hentikan infinite doom loop agen AI |
| `runtime-guard` | Validasi edge-cases & memory leaks |

## GitHub Action

```yaml
- uses: de-slop/action@v1
  with:
    command: check
```

## MCP Integration

```json
{
  "mcpServers": {
    "de-slop": { "command": "npx", "args": ["de-slop", "mcp"] }
  }
}
```

Lihat `docs/` untuk detail arsitektur, taksonomi masalah, dan roadmap.

## License

MIT

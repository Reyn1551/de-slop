# MCP Integration

de-slop menyediakan MCP server agar AI editor (Cursor, Claude Code) bisa memanggil tools anti-slop secara langsung.

## Setup

```bash
npx de-slop mcp
```

## Konfigurasi Client

```json
{
  "mcpServers": {
    "de-slop": {
      "command": "npx",
      "args": ["de-slop", "mcp"]
    }
  }
}
```

## Tools yang Tersedia

| Tool | Fungsi |
|---|---|
| `check_slop` | Scan file/diff untuk pola AI slop |
| `verify_tests` | Pastikan test tidak dimodifikasi AI |
| `check_package` | Validasi package sebelum install |
| `spec_verify` | Verifikasi kode terhadap spec contract |

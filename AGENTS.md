# AGENTS.md — Constraints untuk Agen AI di Repo Ini

Aturan ini mengikat semua agen AI yang bekerja di repo de-slop.

## Larangan Keras
1. **JANGAN modifikasi file test** untuk membuat kode lolos. Test adalah kontrak.
2. **JANGAN tambah dependency** tanpa justifikasi di PR description.
3. **JANGAN tambah komentar yang menjelaskan hal obvious** (`// increment i` di atas `i++`).
4. **JANGAN buat abstraksi** untuk sesuatu yang hanya dipakai sekali.

## Kewajiban
1. Jalankan `npm test` sebelum selesai. Buktikan dengan output, bukan klaim.
2. Perubahan behavior harus traceable ke spec di `docs/SPEC.md` atau issue.
3. Maksimal 3 retry per error — jika masih gagal, berhenti dan laporkan.
4. Commit pakai Conventional Commits (`feat(core):`, `test(e2e):`, `chore:`) — konsisten dengan log git.

## Struktur
- `packages/core` — semua logika (AST-first, bukan regex). 7 modul: `slop-scanner`, `test-lock`, `package-gate`, `circuit-breaker`, `runtime-guard`, `spec-contractor`, `ast-pruner`. Masing-masing punya test vitest di foldernya.
- `packages/cli` (bin `de-slop`, ESM), `packages/mcp-server` (stdio MCP, `@modelcontextprotocol/sdk`), `packages/action` — adapter tipis di atas core.

## Parser: Wajib Paham Sebelum Menyentuh AST
- `typescript@7` = native tsgo. API klasik `ts.createSourceFile` TIDAK ada.
- Semua modul AST memakai bridge `packages/core/src/slop-scanner/ts-api.ts`: `require('typescript/unstable/ast')` + `typescript/unstable/sync` + virtual FS.
- `parseSourceFile(code, filePath)` dan `scanSource(code, filePath, options)` ada di `slop-scanner/scanner.ts`. Rule ditulis gaya klasik (`ast.isX`, `SyntaxKind`, `forEachChild`).

## Verifikasi
```bash
npm run build       # tsc core + mcp-server → dist
npm test            # vitest (semua test, ~226)
npm run typecheck   # tsc --noEmit core + mcp-server
```
CLI butuh core di-build dulu: `npm run build` sebelum `node packages/cli/bin/de-slop.js`.

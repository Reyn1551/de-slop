# AGENTS.md: aturan untuk agen AI di repo de-slop

Aturan ini mengikat semua agen AI yang bekerja di repo ini.

## Larangan keras

1. Jangan ubah file test supaya kode lolos. Test adalah kontrak.
2. Jangan tambah dependency tanpa justifikasi di PR description.
3. Jangan tulis komentar yang mengulang kode di bawahnya.
4. Jangan buat abstraksi untuk sesuatu yang dipakai sekali.
5. Jangan longgarkan aturan lint supaya lolos. Perbaiki kodenya, atau buang rule itu dengan alasan yang ditulis di commit.

## Kewajiban

1. Jalankan `npm test` sebelum selesai. Buktikan dengan output, bukan klaim.
2. Perubahan behavior harus bisa dilacak ke `docs/SPEC.md` atau issue.
3. Maksimal 3 percobaan per error. Kalau masih gagal, berhenti dan laporkan.
4. Commit pakai Conventional Commits (`feat(core):`, `test(e2e):`, `chore:`), konsisten dengan log git.
5. Setelah mengubah rule, jalankan `de-slop check` pada repo ini. Rule yang berisik di source sendiri belum selesai.

## Struktur

`packages/core` menyimpan semua logika. 16 modul: `slop-scanner`, `runtime-guard`, `agent-guard`, `design-slop`, `design-contract`, `ux-guard`, `prose-slop`, `context-rot`, `mcp-guard`, `commit-guard`, `degradation`, `test-lock`, `package-gate`, `spec-contractor`, `circuit-breaker`, `ast-pruner`. Masing-masing punya test vitest di foldernya.

`packages/cli` (bin `de-slop`, ESM), `packages/mcp-server` (stdio MCP), `packages/action`, dan `packages/vscode-extension` adalah adapter tipis di atas core. Detector dipilih di satu tempat: `packages/core/src/scan.ts`.

Rule baru = satu file di `rules/`, satu baris di registry `index.ts`, dan satu entri di `packages/core/src/rules-catalog.ts`. Test gagal kalau entri katalog hilang atau basi. Id rule dipakai sebagai filter `--rules` dan kunci tabel laporan, jadi harus unik lintas modul.

## Parser: pahami sebelum menyentuh AST

- `typescript@7` adalah native tsgo. `ts.createSourceFile` tidak ada.
- Semua modul AST memakai bridge `packages/core/src/slop-scanner/ts-api.ts`: `require('typescript/unstable/ast')` + `typescript/unstable/sync` + virtual FS.
- `parseSourceFile(code, filePath)` dan `scanSource(code, filePath, options)` ada di `slop-scanner/scanner.ts`. Rule ditulis gaya klasik (`ast.isX`, `SyntaxKind`, `forEachChild`).
- Virtual FS memakai 512 slot berputar. Jangan simpan referensi `SourceFile` melewati 512 parse berikutnya.

## Konvensi rule

- Severity `error` hanya untuk cacat yang bisa dibuktikan: test gagal, package tidak ada, XSS, kontras WCAG, chatbot residue di dokumen terbit.
- Pola yang butuh keputusan manusia tetap `warning`.
- Fixture dan file test berisi pola buruk dengan sengaja. Setiap modul melewati path `tests/`, `fixtures/`, dan `*.test.*`.
- Cocokkan dengan cakupan terdekat (elemen, blok CSS, blok deklarasi), bukan seluruh file. Pencocokan file-global menghasilkan false positive yang membuat orang berhenti membaca output.

## Verifikasi

```bash
npm run build       # tsc core + mcp-server ke dist
npm test            # vitest, 535 test
npm run typecheck   # tsc --noEmit core + mcp-server
node packages/cli/bin/de-slop.js check .   # butuh build dulu
```

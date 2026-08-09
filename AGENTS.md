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

## Struktur
- `packages/core` — semua logika (AST-first, bukan regex).
- `packages/cli`, `packages/mcp-server`, `packages/action` — adapter tipis di atas core.

# Contributing

## Setup

```bash
npm install
npm test
```

## Workflow
1. Fork + branch dari `main`.
2. Baca `AGENTS.md` — berlaku untuk manusia dan AI.
3. Tambah test untuk setiap rule/fitur baru.
4. `npm run lint && npm run typecheck && npm test` harus hijau.
5. PR dengan deskripsi masalah yang diselesaikan.

## Menambah Slop Rule Baru
1. Tambah rule di `packages/core/src/slop-scanner/rules/`.
2. Tambah fixture di `tests/fixtures/`.
3. Dokumentasikan pola di `docs/PROBLEM_TAXONOMY.md`.

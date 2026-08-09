# ORKESTRASI: Implementasi penuh repo de-slop

## Goal
Semua 6 modul core (slop-scanner, test-lock, package-gate, circuit-breaker, runtime-guard, spec-contractor + ast-pruner) terimplementasi TypeScript AST-first, adapter CLI/MCP/action jalan, `npm test` hijau, setiap milestone di-push ke main.

## Keputusan stack (tetap)
- TS source, parser = TypeScript Compiler API, runtime Node>=18, vitest.
- Core compile: `tsc -p packages/core` → `dist/` CommonJS.
- Dependency baru HANYA `@modelcontextprotocol/sdk` (justifikasi: standar resmi MCP). Selain itu: typescript, vitest, eslint, @types/node saja.

## Unit Kerja
| # | Unit | Dependensi | Agent | Status | Catatan |
|---|------|-----------|-------|--------|---------|
| 0 | Setup TS infra (tsconfig.base, tsconfig per package, npm install, build/test script, hapus stub .js di core) | - | fullstack-coder | pending | Commit: chore: setup TypeScript build infra |
| 1 | slop-scanner (6 rules + fixer + API scanSource) | 0 | fullstack-coder | pending | Paralel batch A |
| 2 | package-gate (checkPackage + interceptInstall, fetch global) | 0 | fullstack-coder | pending | Paralel batch A |
| 3 | circuit-breaker (class + state machine) | 0 | fullstack-coder | pending | Paralel batch A |
| 4 | test-lock (fingerprintTests, verifyTests, lock/verify file) | 0 | fullstack-coder | pending | Paralel batch B |
| 5 | runtime-guard (require-cleanup, no-floating-promise, no-unhandled-null) | 0 | fullstack-coder | pending | Paralel batch B; reuse infra scanner jika sudah ada, jika belum buat walker lokal sendiri |
| 6 | spec-contractor + ast-pruner (YAML subset parser + invariant check + pruneContext) | 0 | fullstack-coder | pending | Paralel batch B |
| 7 | CLI wiring (check/fix/init/mcp import core dist) | 1-6 | fullstack-coder | pending | Setelah core lengkap |
| 8 | MCP server (stdio, 4 tools) | 1-6 | fullstack-coder | pending | Setelah core lengkap |
| 9 | Verifikasi menyeluruh (npm test, typecheck, e2e CLI fixture) | 7,8 | tester | pending | npm test hijau wajib |
| 10 | Sinkron docs (README, AGENTS.md, docs/*) | 9 | doc-writer | pending | Terakhir |

## Catatan orkestrasi
- Paralel maks 4. Batch A: 1,2,3. Batch B: 4,5,6.
- Setiap subagent WAJIB: npm test hijau untuk modulnya + commit + push ke main sendiri (conventional commit).
- Unit 5 diberi instruksi: JANGAN tunggu slop-scanner; tulis AST walker sendiri di modulnya.
- Unit 0 dikerjakan dulu sendiri (blok semua).

## Log
- Plan ditulis.
- BLOKIR: Task tool error "Subagent depth limit reached (1)" — orchestrator berjalan sebagai subagent, tidak bisa dispatch specialist.
- BLOKIR: permission rule edit deny `*`, allow hanya `.orc/**` — orchestrator tidak bisa tulis file produksi (sesuai desain).
- Kesimpulan: butuh user action — naikkan subagent_depth, ATAU jalankan ulang orkestrasi dari sesi utama (bukan subagent), ATAU izinkan edit di luar .orc.
- Status semua unit: blocked menunggu keputusan user.

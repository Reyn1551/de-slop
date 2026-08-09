# Problem Taxonomy — Vibe Coding & AI Slop

Master taksonomi masalah yang diatasi de-slop.

## 1. Test Degradation
- AI menulis ulang unit test agar lolos (test yang dihapus/di-skip).
- **Solusi de-slop:** `test-lock` — AST fingerprinting test file.

## 2. Spec Drift
- Kode menyimpang dari requirement/spec.
- **Solusi de-slop:** `spec-contractor` — Spec-Driven Development contract.

## 3. AI Slop Code
- Pola boilerplate AI: redundant comments, over-abstraction, dead code, generic naming.
- **Solusi de-slop:** `slop-scanner` — AST linter rules.

## 4. Slopsquatting
- AI menghalusinasi package yang tidak ada → supply-chain attack vector.
- **Solusi de-slop:** `package-gate` — package existence & reputation firewall.

## 5. Infinite Doom Loop
- Agen AI retry loop tanpa henti saat error.
- **Solusi de-slop:** `circuit-breaker` — stop condition enforcement.

## 6. Runtime Fragility
- Edge-case tidak ditangani, memory leak, unhandled rejection.
- **Solusi de-slop:** `runtime-guard` — validator runtime.

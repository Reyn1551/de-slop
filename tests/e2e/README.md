# E2E Tests

End-to-end tests untuk CLI (`packages/cli`) dan modul core. Menjalankan binary sungguhan lewat `execFileSync`.

- `cli.e2e.test.ts` — check (slop/clean fixture, `--rules` filter, exit codes), fix (redundant comment + unused var), init (`.desloprc.json` + pre-commit hook di git repo temp), test-lock verify (lock → weaken → deteksi).

Fixtures ada di `../fixtures/`. Cakupannya: `tests/**/*.test.ts` (vitest.config.ts).

# Test Fixtures

Sample kode kotor (slop) dan bersih untuk menguji rules `slop-scanner`, `test-lock`, dan `spec-contractor`.

| File | Kegunaan |
|---|---|
| `slop-fixture.ts` | Kode kotor: hardcoded secret (`no-hardcoded-secret`), unused var, empty catch, redundant comment. CLI `check` harus exit 1. |
| `clean-fixture.ts` | Kode bersih. CLI `check` harus exit 0. |
| `test-lock/locked.fixture.ts` | File test untuk lock → weaken → verify (`test-lock`). |
| `spec/de-slop.spec.yml` | Spec YAML untuk `spec-contractor` (functions + invariants). |

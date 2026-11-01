# Test fixtures

Sample code for the CLI and module tests.

| File | Purpose |
|---|---|
| `slop-fixture.ts` | Dirty code: hardcoded secret, unused variable, empty catch, redundant comment. `de-slop check` must exit 1. |
| `clean-fixture.ts` | Clean code. `de-slop check` must exit 0. |
| `test-lock/locked.fixture.ts` | A test file used for lock, weaken, verify. |
| `spec/de-slop.spec.yml` | Spec contract for `spec-contractor`. |

Fixtures contain slop on purpose, so `.desloprc.json` excludes this directory
from repo-wide scans.

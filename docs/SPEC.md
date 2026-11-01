# Spec — Spec-Driven Development Contract

## Concept

Every code change should trace to a spec. de-slop enforces the contract between
a spec file and the implementation that claims to satisfy it.

## Format

```yaml
# de-slop.spec.yml
specs:
  - id: auth-login
    description: User login with email and password
    contract:
      input: { email: string, password: string }
      output: { token: string } | { error: string }
      invariants:
        - password is never logged
        - token expiry <= 24h
```

## Enforcement

`spec-contractor` parses the file and checks the implementation:

- a declared function must exist in the scanned sources
- a declared invariant must hold as a textual or structural condition

CI fails when either check fails.

## Writing invariants

An invariant is a claim a reviewer could disprove by reading the code. "Password
is never logged" is checkable. "The code is clean" is not.

Keep invariants short and specific. One claim per line.

## Related checks

Spec drift is one of ten failure modes de-slop covers. The others, and the
module that catches each, are in `docs/PROBLEM_TAXONOMY.md`.

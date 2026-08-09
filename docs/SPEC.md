# Spec — Spec-Driven Development Contract

## Konsep
Setiap perubahan kode harus traceable ke spec. de-slop menegakkan kontrak antara spec dan implementasi.

## Format Spec

```yaml
# de-slop.spec.yml
specs:
  - id: auth-login
    description: User login dengan email+password
    contract:
      input: { email: string, password: string }
      output: { token: string } | { error: string }
      invariants:
        - password tidak pernah di-log
        - token expiry <= 24h
```

## Enforcement
- `spec-contractor` memverifikasi kode implementasi terhadap contract.
- CI gagal jika invariant dilanggar.

# Contributing

## Setup

```bash
npm install
npm test
```

## Workflow

1. Fork and branch from `main`.
2. Read `AGENTS.md`. It binds humans and agents alike.
3. Add a test for every new rule or feature.
4. `npm run lint && npm run typecheck && npm test` must pass.
5. Open a PR that names the problem it solves.

## Adding a rule

1. Pick the module that owns the concept. Code shape goes in `slop-scanner`,
   runtime behaviour in `runtime-guard`, visual tells in `design-slop`,
   accessibility in `ux-guard`, writing in `prose-slop`, agent instructions in
   `context-rot`.
2. Create one file under that module's `rules/` directory.
3. Register it in the module's `index.ts` map. The id is also the `--rules`
   filter, so it must be unique across every module.
4. Add positive and negative cases to the module's test file. A rule without a
   negative case will fire on real code.
5. Document the pattern in `docs/PROBLEM_TAXONOMY.md`.
6. Run `node packages/cli/bin/de-slop.js check .` and confirm the new rule does
   not fire on this repo's own source. A rule that reports its own fixtures or
   its own rule files is not finished.

## Rule checklist

- Does it match the nearest scope (element, CSS block, function) instead of the
  whole file? File-global matching is the main source of false positives here.
- Is the severity right? `error` only for defects a reviewer could prove.
- Does the message say what to do instead of only what is wrong?
- Does it skip test files and fixtures?

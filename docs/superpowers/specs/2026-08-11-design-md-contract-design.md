# Design: DESIGN.md Contract Engine (design-contract)

**Date:** 2026-08-11
**Status:** Approved (user, via brainstorming)
**Scope:** New core module + CLI wiring. No dependency added (hand-rolled YAML-subset parser).

## Problem

de-slop flags design patterns (purple palette, Inter font, glow shadows, gradients) as
AI slop. But these are only *tells* when they are AI defaults chosen without intent. Real
products with a design system — shadcn/ui, anime.js, 21st.dev, typeui.sh — deliberately
use some of these patterns (blue-600, Inter, glow components, FAQ accordions) and read as
*human* because the choice is declared and consistent.

DESIGN.md (google-labs-code/design.md, alpha spec) is the machine-readable contract that
declares intent: YAML frontmatter tokens (colors, typography, rounded) + body prose with
Do's and Don'ts. This design makes de-slop contract-aware: read DESIGN.md, exempt declared
values, detect drift between code and spec, and penalize slop bundles when no contract exists.

## Decisions (from user Q&A)

1. **Parser:** hand-rolled YAML-subset parser, no dependency.
2. **Drift scope:** colors + font-family + radius.
3. **Module:** new `packages/core/src/design-contract/`.
4. **Behavior:** exemption + drift detection + bundle penalty when no DESIGN.md.
5. **Resolution:** walk-up from cwd (design.md / DESIGN.md / docs/design.md).

## Architecture

### Module: `packages/core/src/design-contract/`

**`types.ts`**
```ts
export interface DesignColor { token: string; value: string /* normalized sRGB hex #RRGGBB */ }
export interface DesignTypography { token: string; fontFamily: string; fontWeight?: string }
export interface DesignRadius { token: string; value: string /* px value */ }
export interface DesignContract {
  path: string;
  version: string;
  colors: Map<string, string>;       // token -> normalized hex
  typography: Map<string, string>;   // token -> fontFamily string
  rounded: Map<string, string>;      // token -> px value
  omitted: string[];
  raw: string;
}
```

**`parser.ts`** — `parseDesignContract(code, path): DesignContract | Error`
- Extract `---` YAML frontmatter block.
- Hand-rolled subset: top-level keys `version`, `colors`, `typography`, `rounded`, `omitted`.
- Colors: accept `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb()`, `hsl()`, `oklch()`, named colors;
  normalize to sRGB hex `#RRGGBB` (spec-compliant for WCAG checking). Color-mix unsupported
  (warning, not error).
- Typography: `fontFamily` required per entry; optional `fontWeight`.
- Rounded: `Dimension` → px string.
- Ref syntax `{path.to.token}`: resolve to referenced value when inline.
- **Duplicate section heading in body → reject file** (spec-compliant).
- Unknown section in body → preserve, no error (spec-compliant).
- `omitted` array suppresses "missing section" concerns.

**`resolver.ts`** — `findDesignContract(cwd): DesignContract | null`
- Candidates per dir: `design.md`, `DESIGN.md`, `docs/design.md`, `docs/DESIGN.md`.
- Walk up `cwd` → parents until hit (stop at filesystem root).
- First hit wins; parse errors → null + collector of parse error (exposed for CLI warning).

**`exemptions.ts`**
- `getExemptions(contract): { colors: Set<string>, fonts: Set<string>, radii: Set<string> }`.
- Colors: normalized hex set from `contract.colors` values.
- Fonts: lowercase family names from `contract.typography` fontFamily (first family in list).
- Radii: px values from `contract.rounded`.
- Helpers: `isExemptColor(hex)`, `isExemptFont(family)`, `isExemptRadius(value)`.

**`drift.ts`** — `scanDrift(code, filePath, contract): Diagnostic[]`
- Per file: find color literals (`#hex`, `rgb()`, `hsl()` in CSS + className Tailwind color
  classes `text-/bg-/border-/from-/to-/ring-/shadow-{color}-{shade}`), font-family
  declarations, radius values (`rounded-*`, `rounded-[Npx]`).
- For each value NOT in exemptions AND that collides with a contract token's *semantic slot*
  → drift error: `design-contract-drift` "code uses #8B5CF6, DESIGN.md declares primary #0EA5E9".
- **Collision rule:** drift = a color literal / font-family / radius value used **>= 3 times**
  in the project that is **not present in the contract's exemptions**. High-frequency +
  undeclared = deliberate choice that violates the spec. Low-frequency (< 3) is treated as
  incidental and skipped (avoids flagging `bg-slate-800` surfaces when contract declares only
  `primary`). Exempted (declared) values never drift.
- Font-family drift: family not in contract.typography fonts and file is the theme/index.css.
- Radius drift: `rounded-[Npx]` value not in contract.rounded and used 3+ times.
- Frequency counting is per-project (aggregate across scanned files), not per-file.

**`index.ts`** — public surface:
- `parseDesignContract`, `findDesignContract`, `getExemptions`, `scanDrift`, types.
- `designContractScan(code, filePath, options)` convenience combining drift.

### design-slop wiring (`packages/core/src/design-slop/index.ts`)

`scanDesignSlop(code, filePath, options)` gains:
- `options.contract?: DesignContract`
- `options.hasContract?: boolean`

Exemption hooks in rules:
- `no-ai-purple`: skip flagged hex if `isExemptColor(hex)`.
- `no-slop-font`: skip Inter/slop-display if `isExemptFont(family)`.
- `no-glow-shadow`: skip if glow color hex exempted.
- (`no-gradient-text`/`no-gradient-button` remain structural — no color exemption needed.)

Bundle penalty:
- If `options.hasContract === false` → threshold 4 → 3, and bundle message appends
  `(project has no DESIGN.md — add one to declare intent)`.
- If `options.hasContract === true` → threshold stays 4 (declared systems get benefit of doubt).

### CLI wiring

`packages/cli/src/scan.js`:
- `scanFile(filePath, rules, contractCtx)` where `contractCtx = { contract, hasContract }`.
- Pass `contractCtx` into `designSlopScan(code, filePath, {...options, ...contractCtx})`.
- Run `designContractScan` (drift) for files when contract exists.

`packages/cli/src/commands/check.js`:
- Resolve `findDesignContract(process.cwd())` once per run.
- Pass to `scanFile`.
- Report line: if `hasContract` → show `Using DESIGN.md: <path>`; else warning
  `no DESIGN.md found — slop flags are strict`.
- `--design-md <path>` flag override for explicit path.

### Tests

`design-contract/design-contract.test.ts`:
- parser: valid contract, duplicate-section reject, invalid YAML, ref syntax, color formats
  (#RGB, #RRGGBB, rgb, hsl, oklch), omitted array.
- resolver: walk-up found, not-found → null.
- exemptions: color/font/radius sets built correctly.
- drift: drift error fired, consistent code silent, exempted never drifts.

`design-slop/design-slop.test.ts` additions:
- declared purple silent (no-ai-purple exemption).
- declared Inter silent (no-slop-font exemption).
- bundle threshold 3 fires when hasContract=false, 4 stays when true.
- contract passed via options filters correctly.

CLI: manual dogfood on PRD-Generator after adding a DESIGN.md; dogfood de-slop itself.

## Out of scope (v1)

- Color-mix() parsing (warn only).
- spacing drift (decision: colors+font+radius only).
- DESIGN.md generation command (future; separate feature).
- Do's and Don'ts enforcement (prose, not machine-checkable).
- Multi-contract monorepo per-package resolution (walk-up covers most).

## Verification

- `npx tsc --noEmit -p packages/core` clean.
- `npx vitest run` all green (existing 244 + new).
- `npm run build`.
- Dogfooding: PRD-Generator with DESIGN.md → exemptions active; without → strict.

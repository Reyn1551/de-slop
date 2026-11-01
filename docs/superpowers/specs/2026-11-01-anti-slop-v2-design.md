# Design: de-slop v0.2 — prose, UX, degradation, supply chain

**Date:** 2026-11-01
**Status:** Approved by mandate (user asked for broad upgrades plus progressive pushes)
**Scope:** 3 new core modules, 1 hardened module, CLI + MCP wiring, docs rewrite.
**Dependencies added:** none.

## Problem

de-slop v0.1 covers code slop (AST rules), design tells (regex over className/CSS),
test manipulation, package reputation, agent loop budgets, and spec drift.
Four gaps remain:

1. **Prose slop.** Docs, READMEs, commit bodies, and PR descriptions carry the
   strongest AI tells: not-X-but-Y contrasts, staged openers, inflated
   significance, chatbot residue, em-dash saturation. No module reads prose.
2. **UX regressions.** design-slop judges taste. Nothing measures the rules a
   reviewer can prove: contrast ratios, touch target size, focus visibility,
   zoom blocking, placeholder-only labels, reduced-motion, heading order.
3. **Degradation over time.** SlopCodeBench (arXiv:2603.24755) shows agent code
   is 2.3x more verbose and 2.0x more eroded than human repos, and worsens every
   iteration (erosion rises in 77% of trajectories). de-slop measures a snapshot
   and never a trend.
4. **Typosquats.** package-gate catches packages that do not exist. It misses
   packages that exist but imitate a popular name by one character.

## Research inputs

| Source | What it contributes |
|---|---|
| blader/humanizer v3.1 (Wikipedia "Signs of AI writing") | 26 prose tells, ordered by strength; rules §1, §2, §4, §8, §12-19 drive `prose-slop` |
| nextlevelbuilder/ui-ux-pro-max | 119 UX guidelines with WCAG/Apple HIG/Material thresholds: 4.5:1 text contrast, 44x44 touch, 24x24 web target, 16px body, reduced-motion |
| SlopCodeBench (arXiv:2603.24755) | `erosion = mass(CC>10)/mass(all)`, `mass = CC * sqrt(SLOC)`, `verbosity = |flagged ∪ clone lines| / LOC`; human means 0.34 / 0.19, agent means 0.68 / 0.44 |
| CSA slopsquatting note (2026-04-19) | Attackers pre-register hallucinated names; one-character variants are the cheapest vector |
| stop-slop skill | Prose discipline applied to every doc in this repo |

## Module 1: `prose-slop`

Pure text analysis, no AST, no network. Runs on `.md`, `.mdx`, `.txt`, `.rst`,
and on JSDoc/line comments when `includeComments` is set.

```ts
export interface ProseMetrics {
  words: number;
  sentences: number;
  paragraphs: number;
  emDashes: number;
  aiWords: number;
  score: number; // 0-100, higher = more slop
}

export interface ProseScanResult {
  diagnostics: Diagnostic[];
  metrics: ProseMetrics;
}

export function scanProse(code: string, filePath: string, options?: ProseOptions): Diagnostic[];
export function analyzeProse(code: string, filePath: string, options?: ProseOptions): ProseScanResult;
export const PROSE_SLOP_RULES: Record<ProseRuleId, ProseRuleFn>;
```

Rules (id, detection, severity):

| Rule | Detection | Severity |
|---|---|---|
| `no-not-x-but-y` | `not just/only/merely X but Y`, `it's not X, it's Y`, `bukan hanya X tetapi Y` | warning |
| `no-staged-opener` | `let's dive in`, `here's what you need to know`, `in today's fast-paced`, `mari kita bahas` | warning |
| `no-chatbot-residue` | `I hope this helps`, `Great question!`, `Certainly!`, `Let me know if`, `Would you like me to` | error |
| `no-inflated-significance` | `stands as a testament`, `pivotal moment`, `plays a crucial role`, `evolving landscape` | warning |
| `no-sales-language` | `nestled`, `breathtaking`, `must-visit`, `game-changer`, `seamless`, `unlock the power` | warning |
| `no-fake-depth` | `at its core`, `the real question is`, `what really matters`, `the deeper issue` | warning |
| `no-ai-vocabulary` | density of delve, tapestry, testament, meticulous, intricate, pivotal, robust, showcase, underscore, vibrant, garner, bolster, myriad, realm | warning at >=3 distinct |
| `no-em-dash-overload` | em/en dash density > 0.5 per 100 words and count >= 3 | warning |
| `no-bold-label-list` | 3+ lines matching `- **Label:** text` | warning |
| `no-decorative-heading` | heading with emoji/arrow, or Title Case on 4+ words | warning |
| `no-hedge-stack` | `could potentially`, `might possibly`, `it could be argued` | warning |
| `no-vague-attribution` | `experts say`, `studies show`, `research proves` with no link in the paragraph | warning |
| `no-repeated-opener` | 3+ consecutive sentences start with the same word | warning |
| `no-forced-triad` | `word, word, and word.` single-word triad | warning |
| `no-closer-line` | short standalone paragraph matching `That's the real win`, `That distinction matters`, `Let that sink in` | warning |

Scoring: `score = min(100, round(1000 * weightedTells / max(words, 100)))` where
error weight 3, warning weight 1. `score >= 25` emits a file-level
`prose-slop-bundle` error.

Skips: files under `docs/superpowers/specs/` are scanned (they are prose), but
rule tables and code fences are stripped before analysis. Fenced code, inline
code, and link URLs never count as prose.

## Module 2: `ux-guard`

Regex over JSX/HTML/CSS, same rule-function shape as `design-slop`.

```ts
export interface UxGuardOptions { rules?: string[] }
export function scanUx(code: string, filePath: string, options?: UxGuardOptions): Diagnostic[];
export const UX_RULES: Record<UxRuleId, UxRuleFn>;
```

Rules:

| Rule | Detection | Severity |
|---|---|---|
| `no-img-without-alt` | `<img>` with no `alt` | error |
| `no-icon-only-button` | `<button>` whose only child is an icon/emoji, no `aria-label`/`title` | error |
| `no-placeholder-only-label` | `<input placeholder>` with no `aria-label`, `aria-labelledby`, or `id` | error |
| `no-focus-outline-removal` | `outline: none`, `outline-0`, `focus:outline-none` with no `:focus-visible` replacement | error |
| `no-zoom-block` | `user-scalable=no`, `maximum-scale=1` | error |
| `no-low-contrast-pair` | CSS rule with `color` + `background` resolvable to hex/rgb and ratio < 4.5:1 | error |
| `no-small-touch-target` | interactive element with `h-8`/`h-9`/`w-8`/`w-9` (32-36px) | warning |
| `no-motion-without-reduced-motion` | `animate-`/`@keyframes`/`transition-` and no `prefers-reduced-motion` | warning |
| `no-tiny-body-text` | `text-[10px]`/`text-[11px]`/`text-[12px]` on `p`/`li` | warning |
| `no-heading-skip` | `h1` followed by `h3` with no `h2` | warning |
| `no-hover-only-reveal` | `opacity-0` + `group-hover:opacity-100` with no `focus-within`/`focus-visible` | warning |
| `no-fixed-pixel-width` | `w-[Npx]`/`min-w-[Npx]` with N >= 1024 | warning |
| `no-z-index-extreme` | `z-[N]` with N >= 999 | warning |

`no-low-contrast-pair` implements WCAG 2.x relative luminance:
`(L1 + 0.05) / (L2 + 0.05)`, with alpha compositing over the declared background.
Colors parse from `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()/rgba()`, and named
CSS colors (a 16-entry subset covering black, white, and the common greys).

## Module 3: `degradation`

Metrics follow SlopCodeBench exactly so numbers are comparable to its published
human and agent baselines.

```ts
export interface FunctionMetric {
  name: string;
  startLine: number;
  cyclomatic: number;
  sloc: number;
  mass: number; // cyclomatic * sqrt(sloc)
}

export interface FileMetrics {
  filePath: string;
  loc: number;
  sloc: number;
  functions: FunctionMetric[];
  erosion: number;    // mass in CC>10 functions / total mass
  verbosity: number;  // |flagged ∪ clone lines| / loc
  flaggedLines: number[];
  cloneLines: number[];
  maxCyclomatic: number;
}

export function analyzeFile(code: string, filePath: string): FileMetrics;
export function analyzeProject(files: { filePath: string; code: string }[]): ProjectMetrics;
export function compareBaseline(current: ProjectMetrics, baseline: ProjectMetrics): BaselineDelta;
```

- Cyclomatic complexity counts `if`, `for`, `while`, `do`, `case`, `catch`,
  ternary, `&&`, `||`, `??` inside each function body, plus 1 for the function.
- Clone detection normalizes lines (trim, collapse internal whitespace, drop
  blanks and braces-only lines) and marks every line belonging to a 5-line
  window that occurs at least twice in the file.
- Flagged lines come from 12 verbose-code patterns: `else { return }` after
  `return`, `return await`, `=== true`/`!== false`, `if (x) return true; else
  return false;`, empty `else {}`, single-statement wrapper functions,
  redundant `Array.from(x).map`, `x.length > 0 ? ... : ...` on arrays,
  `typeof x !== 'undefined'` in a modern scope, `String(x)` around a template
  literal, `await Promise.resolve(...)`, and `if (cond) { } else { }` with an
  empty branch.

Baseline: `.de-slop/baseline.json` stores `{ erosion, verbosity, loc, files }`.
CLI `de-slop budget` compares current metrics to the baseline and fails when
erosion or verbosity exceed the stored value by more than `--tolerance`
(default 0.02) or the absolute ceiling (erosion 0.34, verbosity 0.19, the human
means from the paper).

## Module 4: `package-gate` typosquat detection

```ts
export type Verdict = 'ok' | 'suspicious' | 'not-found' | 'unknown' | 'typosquat';
export function findTyposquat(name: string, ecosystem: Ecosystem): TyposquatMatch | null;
```

- Damerau-Levenshtein distance 1 against a 180-name corpus of top npm/PyPI
  packages, plus separator and scope tricks (`lodash.merge` vs `lodash-merge`,
  `@types/node` vs `types-node`).
- Exact corpus names never match. Names shorter than 4 characters never match.
- Verdict `typosquat` blocks the install in `intercept` and ranks above
  `suspicious` in reports.

## Wiring

- `packages/core/src/index.ts` exports `proseSlop`, `uxGuard`, `degradation`.
- `packages/cli/src/scan.js` runs prose-slop on doc extensions and ux-guard on
  code extensions, so `check` covers everything.
- New CLI command `de-slop budget` for degradation metrics and baselines.
- MCP server gains `check_prose`, `check_ux`, `check_degradation` (7 tools total).
  The e2e contract test is updated to the new full list; no assertion is loosened.
- `.desloprc.json` gains optional `prose` and `ux` sections for rule selection.

## Verification

- `npm run typecheck` clean.
- `npm test` green, including new per-module suites and updated MCP e2e.
- `npm run build` then `node packages/cli/bin/de-slop.js check .` on this repo:
  zero errors.
- Dogfood: README and docs rewritten until `de-slop check` reports no prose
  tells in them.

## Out of scope

- LLM-based detection. Every rule stays deterministic.
- AST parsing of Markdown.
- Locale-aware typography beyond English and Indonesian patterns.
- VS Code extension (unchanged roadmap item).

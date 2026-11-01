# Problem Taxonomy — Vibe Coding & AI Slop

Every category below maps to a module that catches it. The taxonomy drives the
roadmap: a category without a detector is a gap, not a feature.

## 1. Test degradation

An agent rewrites a failing assertion until it passes, comments out the case, or
mocks away the logic under test. CI reports green while the product is broken.

`test-lock` fingerprints the AST of each test file and reports removed tests,
skipped cases, weakened assertions, and happy-path-only coverage.

## 2. Spec drift

Code moves away from the requirement it was written for. Nothing in the build
compares the two.

`spec-contractor` parses `de-slop.spec.yml` and checks that declared functions
exist and declared invariants hold.

## 3. Code slop

Boilerplate an agent adds because it is common in training data: comments that
restate the next line, dead branches, wrapper functions with one caller, generic
names (`data`, `temp`, `result`), magic strings, debug logging left in place.

`slop-scanner` runs 17 AST rules and can rewrite the fixable ones.

## 4. Slopsquatting

An agent recommends a package that does not exist. An attacker registers the
name first and ships an install script that reads environment variables.

`package-gate` checks existence, age, and download volume against the registry,
scans install scripts for `curl | sh` patterns, and flags names within one edit
of a popular package (`lodash` → `lodasl`). Verdict `typosquat` blocks the
install.

## 5. Infinite doom loop

An agent retries the same failing command until the token budget is gone.

`circuit-breaker` enforces budgets for repeated attempts, tool calls, and diff
lines, and trips into an open state instead of looping.

## 6. Runtime fragility

The happy path works. Cleanup is missing, promises float, null checks are absent.

`runtime-guard` flags unresolved promises, missing cleanup for timers and
listeners, and unguarded null access.

## 7. Design slop

The visual signature of a generated landing page: indigo-to-purple gradients,
glassmorphism on every surface, glow shadows, gradient blobs, a pill badge over
the hero heading, emoji used as icons, Inter as the only font, muted grey text on
a dark background.

`design-slop` runs 11 rules and adds a bundle verdict when four or more tells
appear in one file.

## 8. Prose slop

Generated documentation and commit messages carry their own tells: not-X-but-Y
contrasts, staged openers (`let's dive in`), inflated significance (`stands as a
testament`), fake depth (`at its core`), sales language, AI vocabulary (`delve`,
`tapestry`, `meticulous`), dash overload, bold-label lists, and one-line closers.

`prose-slop` runs 14 rules over Markdown and text, masks code fences and URLs
first, and scores each document 0-100. A score of 25 or more adds a bundle
error.

Source: Wikipedia "Signs of AI writing" via the humanizer skill.

## 9. Accessibility regressions

An interface can look finished and still fail a keyboard user: images without
alt text, icon-only buttons with no accessible name, focus rings removed with no
replacement, placeholder-only labels, blocked pinch zoom, touch targets under
44px, animation with no reduced-motion guard.

`ux-guard` runs 12 rules over JSX, HTML, and CSS. These are provable failures
(WCAG 2.2, Apple HIG, Material), not taste judgments.

The counterpart is a DESIGN.md: the project writes down its colors, fonts, and
radii, and `design-slop` stops flagging them. A declared purple is a decision.

## 10. Degradation across iterations

SlopCodeBench (arXiv:2603.24755) measures what single-shot benchmarks hide: over
repeated extension, agent code concentrates complexity into a few functions and
duplicates lines. Agent code is 2.3x more verbose and 2.0x more eroded than 473
human repositories, and erosion rises in 77% of trajectories.

`degradation` computes SlopCodeBench's two metrics — structural erosion
(`mass = CC * sqrt(SLOC)`, share of mass in functions with CC > 10) and verbosity
(`|flagged ∪ clone lines| / LOC`) — then compares a run against a stored
baseline so a repo can fail when quality drops.

## 11. Design drift

A project declares its tokens in DESIGN.md and then outgrows them. A color used
forty times never reaches the contract, so the document stops describing the
product and a reviewer cannot tell a decision from an accident.

`design-contract` parses the contract, exempts the values it declares, and
reports values used repeatedly that it never declares.

## Severity policy

`error` means a provable defect or a security issue: failing tests, missing
packages, XSS, WCAG contrast failures, chatbot residue in published docs.
`warning` means a pattern that needs a human decision. Only errors fail the
build; warnings print and count.

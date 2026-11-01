/**
 * Every rule id de-slop registers, with the one-line description that appears in
 * `docs/RULES.md` and in `de-slop rules`.
 *
 * This catalog is data, not documentation: a test asserts that it covers every
 * registered id and that no entry has gone stale, so a new rule cannot ship
 * without a description and a deleted rule cannot linger here.
 */
export interface RuleDoc {
  id: string;
  module: RuleModule;
  severity: 'error' | 'warning';
  description: string;
}

export type RuleModule =
  | 'slop-scanner'
  | 'runtime-guard'
  | 'agent-guard'
  | 'design-slop'
  | 'ux-guard'
  | 'prose-slop'
  | 'context-rot'
  | 'mcp-guard'
  | 'commit-guard'
  | 'design-contract'
  | 'cross-cutting';

export const RULES_CATALOG: RuleDoc[] = [
  // slop-scanner
  { id: 'no-redundant-comment', module: 'slop-scanner', severity: 'warning', description: 'A comment whose words repeat the statement below it. Fixable.' },
  { id: 'no-dead-code', module: 'slop-scanner', severity: 'error', description: 'A statement after return, throw, break, or continue in the same block. Fixable.' },
  { id: 'no-over-wrapper', module: 'slop-scanner', severity: 'warning', description: 'A function whose body only forwards its own parameters to another call.' },
  { id: 'no-unused-var', module: 'slop-scanner', severity: 'warning', description: 'A binding never referenced by name. Fixable when the initializer has no side effect.' },
  { id: 'no-empty-catch', module: 'slop-scanner', severity: 'warning', description: 'A catch block with no statements, so the failure disappears.' },
  { id: 'no-hardcoded-secret', module: 'slop-scanner', severity: 'error', description: 'A secret-shaped value assigned to a secret-shaped name.' },
  { id: 'no-generic-name', module: 'slop-scanner', severity: 'warning', description: 'An identifier called data, temp, result, item, value, and the like, outside a callback signature.' },
  { id: 'no-injection-risk', module: 'slop-scanner', severity: 'error', description: 'User input concatenated into a SQL, shell, or HTML sink.' },
  { id: 'no-unresolved-import', module: 'slop-scanner', severity: 'error', description: 'A relative import that resolves to no file, which is how a hallucinated module looks.' },
  { id: 'no-missing-docs', module: 'slop-scanner', severity: 'warning', description: 'An exported function or class with no JSDoc block.' },
  { id: 'no-sycophancy', module: 'slop-scanner', severity: 'warning', description: 'A comment that agrees with a reviewer instead of recording a fact.' },
  { id: 'no-accept-all', module: 'slop-scanner', severity: 'warning', description: 'A comment carrying a pasted error or a leftover debug note.' },
  { id: 'no-debug-logging', module: 'slop-scanner', severity: 'warning', description: 'Three or more console calls in a non-CLI file.' },
  { id: 'no-code-bloat', module: 'slop-scanner', severity: 'warning', description: 'A function body over 80 lines, more than 5 parameters, or a 100-character arrow expression.' },
  { id: 'no-magic-string', module: 'slop-scanner', severity: 'warning', description: 'A string literal that is a URL, email, hostname, or four-digit number outside a config file.' },
  { id: 'no-pill-class-string', module: 'slop-scanner', severity: 'warning', description: 'A class string that names a hero pill.' },
  { id: 'no-unsafe-innerhtml', module: 'slop-scanner', severity: 'error', description: 'innerHTML, outerHTML, or dangerouslySetInnerHTML with no sanitizer in scope.' },

  // runtime-guard
  { id: 'require-cleanup', module: 'runtime-guard', severity: 'warning', description: 'A listener or named timer opened with no matching cleanup call.' },
  { id: 'no-floating-promise', module: 'runtime-guard', severity: 'warning', description: 'A call to a declared async function or known async API with no await, return, or catch.' },
  { id: 'no-unhandled-null', module: 'runtime-guard', severity: 'warning', description: 'Property access on the result of find, pop, querySelector, and similar without a guard.' },
  { id: 'no-uncleaned-timer', module: 'runtime-guard', severity: 'warning', description: 'A timer with no handle, so nothing in scope can ever clear it.' },

  // agent-guard
  { id: 'no-prompt-injection', module: 'agent-guard', severity: 'error', description: 'Text that tries to override the agent\u2019s instructions.' },
  { id: 'no-malicious-pattern', module: 'agent-guard', severity: 'error', description: 'A reverse shell, credential exfiltration, or network call carrying a credential.' },
  { id: 'no-secret-logging', module: 'agent-guard', severity: 'error', description: 'A secret-shaped value passed to a log function.' },
  { id: 'no-destructive-command', module: 'agent-guard', severity: 'error', description: 'A destructive shell command built into the source.' },
  { id: 'no-invisible-unicode', module: 'agent-guard', severity: 'error', description: 'Zero-width or bidirectional characters that hide instructions from a reader.' },
  { id: 'no-unsafe-install-docs', module: 'agent-guard', severity: 'error', description: 'Install instructions that pipe a download into a shell or use sudo.' },
  { id: 'no-vite-boilerplate', module: 'agent-guard', severity: 'warning', description: 'Untouched scaffold text left in a README.' },

  // design-slop
  { id: 'no-ai-purple', module: 'design-slop', severity: 'error', description: 'The indigo-to-purple palette AI design defaults to, escalated when a gradient is present.' },
  { id: 'no-gradient-text', module: 'design-slop', severity: 'error', description: 'Background-clipped text, which fails contrast on long copy.' },
  { id: 'no-gradient-button', module: 'design-slop', severity: 'error', description: 'The stock Tailwind gradient-button recipe.' },
  { id: 'no-glassmorphism', module: 'design-slop', severity: 'error', description: 'Backdrop blur on a form field or table, or on more than two surfaces per view.' },
  { id: 'no-glow-shadow', module: 'design-slop', severity: 'warning', description: 'Two or more colored glow shadows used for depth.' },
  { id: 'no-gradient-blob', module: 'design-slop', severity: 'error', description: 'Decorative gradient blobs, escalated to an error when animated without a reduced-motion guard.' },
  { id: 'no-dark-grey-text', module: 'design-slop', severity: 'error', description: 'Muted grey text inside a dark region, which fails WCAG AA contrast.' },
  { id: 'no-pure-black-bg', module: 'design-slop', severity: 'warning', description: 'A pure black page background, which smears on OLED and kills shadows.' },
  { id: 'no-slop-font', module: 'design-slop', severity: 'warning', description: 'Inter as the only declared family, or a display face LLMs converge on.' },
  { id: 'no-hero-pill', module: 'design-slop', severity: 'warning', description: 'A pill badge floating above a hero heading.' },
  { id: 'no-emoji-as-icon', module: 'design-slop', severity: 'warning', description: 'An emoji in an icon slot.' },
  { id: 'design-slop-bundle', module: 'design-slop', severity: 'error', description: 'Four or more distinct design tells in one file (Krebs co-occurrence).' },

  // ux-guard
  { id: 'no-img-missing-alt', module: 'ux-guard', severity: 'error', description: 'An img element with no alt attribute.' },
  { id: 'no-icon-button-unlabeled', module: 'ux-guard', severity: 'error', description: 'A button whose only child is an icon and which has no accessible name.' },
  { id: 'no-focus-removed', module: 'ux-guard', severity: 'error', description: 'Outline removed from a focusable element with no visible replacement.' },
  { id: 'no-placeholder-label', module: 'ux-guard', severity: 'error', description: 'An input whose placeholder is its only label.' },
  { id: 'no-zoom-block', module: 'ux-guard', severity: 'error', description: 'A viewport that blocks pinch zoom.' },
  { id: 'no-touch-target-small', module: 'ux-guard', severity: 'warning', description: 'An interactive element below the 44x44px touch target.' },
  { id: 'no-animation-without-reduced-motion', module: 'ux-guard', severity: 'warning', description: 'Animation with no prefers-reduced-motion guard.' },
  { id: 'no-layout-animation', module: 'ux-guard', severity: 'warning', description: 'An animation on width, height, position, or margin, which forces layout.' },
  { id: 'no-off-grid-spacing', module: 'ux-guard', severity: 'warning', description: 'Arbitrary spacing that is not a multiple of 4px.' },
  { id: 'no-tiny-text', module: 'ux-guard', severity: 'warning', description: 'Text below 12px, or 12px body copy.' },
  { id: 'no-z-index-chaos', module: 'ux-guard', severity: 'warning', description: 'An arbitrary z-index of 1000 or more.' },
  { id: 'no-hover-only', module: 'ux-guard', severity: 'warning', description: 'Content revealed only on hover, with no keyboard equivalent.' },

  // prose-slop
  { id: 'no-not-x-but-y', module: 'prose-slop', severity: 'warning', description: 'A not-X-but-Y contrast, which names a claim nobody made.' },
  { id: 'no-staged-opener', module: 'prose-slop', severity: 'warning', description: 'A run-up that announces the point instead of making it.' },
  { id: 'no-chatbot-residue', module: 'prose-slop', severity: 'error', description: 'A chatbot wrapper left in published text.' },
  { id: 'no-inflated-significance', module: 'prose-slop', severity: 'warning', description: 'An ordinary fact dressed as a turning point.' },
  { id: 'no-sales-language', module: 'prose-slop', severity: 'warning', description: 'Copy that reads like an advertisement.' },
  { id: 'no-fake-depth', module: 'prose-slop', severity: 'warning', description: 'A saying where a specific claim belongs.' },
  { id: 'no-ai-vocabulary', module: 'prose-slop', severity: 'warning', description: 'Words that read as AI wherever they appear.' },
  { id: 'no-em-dash-overuse', module: 'prose-slop', severity: 'warning', description: 'Dash density past the ceiling, which means the author skipped choosing a relation.' },
  { id: 'no-bold-decoration', module: 'prose-slop', severity: 'warning', description: 'Three or more list items carrying a bold label and colon.' },
  { id: 'no-decorative-heading', module: 'prose-slop', severity: 'warning', description: 'A heading with an emoji or arrow, or Title Case on a subheading.' },
  { id: 'no-hedge-stack', module: 'prose-slop', severity: 'warning', description: 'One qualifier stacked on another until the claim dissolves.' },
  { id: 'no-vague-attribution', module: 'prose-slop', severity: 'warning', description: 'An unnamed authority standing in for what was said.' },
  { id: 'no-repeated-opener', module: 'prose-slop', severity: 'warning', description: 'Three sentences in a row opening with the same word.' },
  { id: 'no-closer-line', module: 'prose-slop', severity: 'warning', description: 'A one-line paragraph that restates the point before it.' },
  { id: 'prose-slop-bundle', module: 'prose-slop', severity: 'error', description: 'A document scoring 25 or more out of 100.' },

  // context-rot
  { id: 'no-stale-path', module: 'context-rot', severity: 'warning', description: 'An instruction file naming a path the repository no longer has.' },
  { id: 'no-stale-symbol', module: 'context-rot', severity: 'warning', description: 'An instruction file naming a declaration that no longer exists.' },
  { id: 'no-stale-script', module: 'context-rot', severity: 'warning', description: 'An instruction file telling the agent to run an npm script package.json does not define.' },
  { id: 'no-contradictory-instruction', module: 'context-rot', severity: 'warning', description: 'Two spellings of the same command in one instruction file.' },
  { id: 'no-oversized-instruction', module: 'context-rot', severity: 'warning', description: 'An instruction file past the line budget (100 target, 150 warning, 200 error).' },
  { id: 'no-generic-instruction', module: 'context-rot', severity: 'warning', description: 'An instruction the model already follows by default.' },
  { id: 'no-self-description', module: 'context-rot', severity: 'warning', description: 'A pasted directory tree the agent can read itself.' },
  { id: 'no-duplicate-instruction', module: 'context-rot', severity: 'warning', description: 'A rule stated twice in the same file.' },

  // mcp-guard
  { id: 'no-plaintext-remote', module: 'mcp-guard', severity: 'error', description: 'An MCP server reached over plain http, where tool descriptions travel unwrapped.' },
  { id: 'no-literal-secret-env', module: 'mcp-guard', severity: 'error', description: 'A literal secret in an MCP server env block.' },
  { id: 'no-unpinned-launcher', module: 'mcp-guard', severity: 'warning', description: 'An npx, bunx, or uvx launch with no version pin.' },
  { id: 'no-typosquat-launcher', module: 'mcp-guard', severity: 'error', description: 'A launch package within one edit of a popular name.' },
  { id: 'no-auto-approve-dangerous', module: 'mcp-guard', severity: 'warning', description: 'Auto-approving a tool that writes, execs, or deploys.' },
  { id: 'mcp-config-unparseable', module: 'mcp-guard', severity: 'warning', description: 'An MCP config that is not JSON with a server map.' },

  // commit-guard
  { id: 'no-phantom-path', module: 'commit-guard', severity: 'error', description: 'A commit message naming a file the diff never touched.' },
  { id: 'no-phantom-addition', module: 'commit-guard', severity: 'error', description: 'A message that says a symbol was added when no file declares it.' },
  { id: 'no-phantom-removal', module: 'commit-guard', severity: 'error', description: 'A message that says a symbol was removed when it is still declared.' },
  { id: 'no-test-claim-without-test', module: 'commit-guard', severity: 'error', description: 'A message mentioning tests when the diff touches no test file.' },
  { id: 'no-generic-subject', module: 'commit-guard', severity: 'warning', description: 'A subject like "update code" that names no change.' },
  { id: 'no-oversized-subject', module: 'commit-guard', severity: 'warning', description: 'A subject past 72 characters, which wraps in every review UI.' },
  { id: 'no-unmentioned-scope', module: 'commit-guard', severity: 'warning', description: 'More than five files changed and the message names none of them.' },
  { id: 'no-slop-message-body', module: 'commit-guard', severity: 'warning', description: 'A body reporting an intention instead of a change.' },
  { id: 'commit-empty-message', module: 'commit-guard', severity: 'error', description: 'An empty commit message.' },

  // design-contract
  { id: 'design-contract-drift', module: 'design-contract', severity: 'error', description: 'A color, font, or radius used three or more times that the DESIGN.md never declares.' },

  // cross-cutting: the run itself, not a file pattern
  { id: 'scan-error', module: 'cross-cutting', severity: 'error', description: 'A file the scanner could not read or parse.' },
  { id: 'test-lock', module: 'cross-cutting', severity: 'error', description: 'A test file that no longer matches its locked fingerprint.' },
  { id: 'package-gate', module: 'cross-cutting', severity: 'error', description: 'An install script or dependency that fails the supply-chain gate.' },
];

export const RULE_MODULE_ORDER: RuleModule[] = [
  'slop-scanner',
  'runtime-guard',
  'agent-guard',
  'design-slop',
  'design-contract',
  'ux-guard',
  'prose-slop',
  'context-rot',
  'mcp-guard',
  'commit-guard',
  'cross-cutting',
];

export function rulesByModule(): { module: RuleModule; rules: RuleDoc[] }[] {
  return RULE_MODULE_ORDER.map((module) => ({
    module,
    rules: RULES_CATALOG.filter((rule) => rule.module === module),
  })).filter((group) => group.rules.length > 0);
}

export function findRule(id: string): RuleDoc | undefined {
  return RULES_CATALOG.find((rule) => rule.id === id);
}

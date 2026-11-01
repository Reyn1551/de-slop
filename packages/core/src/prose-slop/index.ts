import type { Diagnostic, ProseContext, ProseFinding, ProseMetrics, ProseScanResult, ProseSlopOptions } from './types';
import { countWords, locatorFor, maskNonProse, splitParagraphs, splitSentences } from './mask';
import { noNotXButY } from './rules/no-not-x-but-y';
import { noStagedOpener } from './rules/no-staged-opener';
import { noChatbotResidue } from './rules/no-chatbot-residue';
import { noInflatedSignificance } from './rules/no-inflated-significance';
import { noSalesLanguage } from './rules/no-sales-language';
import { noFakeDepth } from './rules/no-fake-depth';
import { noAiVocabulary } from './rules/no-ai-vocabulary';
import { noEmDashOveruse } from './rules/no-em-dash-overuse';
import { noBoldDecoration } from './rules/no-bold-decoration';
import { noDecorativeHeading } from './rules/no-decorative-heading';
import { noHedgeStack } from './rules/no-hedge-stack';
import { noVagueAttribution } from './rules/no-vague-attribution';
import { noRepeatedOpener } from './rules/no-repeated-opener';
import { noCloserLine } from './rules/no-closer-line';

export type { Diagnostic, ProseMetrics, ProseScanResult, ProseSlopOptions } from './types';

export const PROSE_SLOP_RULES = {
  'no-not-x-but-y': noNotXButY,
  'no-staged-opener': noStagedOpener,
  'no-chatbot-residue': noChatbotResidue,
  'no-inflated-significance': noInflatedSignificance,
  'no-sales-language': noSalesLanguage,
  'no-fake-depth': noFakeDepth,
  'no-ai-vocabulary': noAiVocabulary,
  'no-em-dash-overuse': noEmDashOveruse,
  'no-bold-decoration': noBoldDecoration,
  'no-decorative-heading': noDecorativeHeading,
  'no-hedge-stack': noHedgeStack,
  'no-vague-attribution': noVagueAttribution,
  'no-repeated-opener': noRepeatedOpener,
  'no-closer-line': noCloserLine,
} as const;

export type ProseSlopRuleId = keyof typeof PROSE_SLOP_RULES;

export const PROSE_SLOP_RULE_IDS = Object.keys(PROSE_SLOP_RULES) as ProseSlopRuleId[];

const BUNDLE_RULE_ID = 'prose-slop-bundle';
const BUNDLE_SCORE = 25;
const ERROR_WEIGHT = 3;
const WARNING_WEIGHT = 1;

const PROSE_EXTENSIONS = /\.(?:md|mdx|markdown|txt|rst|adoc)$/i;
const SKIPPED_PATHS = /(?:^|\/)(?:node_modules|dist|\.git|fixtures?|__fixtures__)\//;

export function isProseFile(filePath: string): boolean {
  return PROSE_EXTENSIONS.test(filePath) && !SKIPPED_PATHS.test(filePath);
}

function buildContext(code: string, filePath: string): ProseContext {
  const text = maskNonProse(code);
  return {
    text,
    raw: code,
    filePath,
    locator: locatorFor(code),
    paragraphs: splitParagraphs(text),
    sentences: splitSentences(text),
    words: countWords(text),
  };
}

function scoreFor(findings: ProseFinding[], wordCount: number): number {
  const weighted = findings.reduce(
    (total, finding) => total + (finding.severity === 'error' ? ERROR_WEIGHT : WARNING_WEIGHT),
    0,
  );
  return Math.min(100, Math.round((1000 * weighted) / Math.max(wordCount, 100)));
}

export function analyzeProse(
  code: string,
  filePath: string,
  options: ProseSlopOptions = {},
): ProseScanResult {
  const context = buildContext(code, filePath);
  const enabled = options.rules
    ? options.rules.filter((id): id is ProseSlopRuleId => id in PROSE_SLOP_RULES)
    : PROSE_SLOP_RULE_IDS;

  const findings: { ruleId: string; finding: ProseFinding }[] = [];
  for (const ruleId of enabled) {
    for (const finding of PROSE_SLOP_RULES[ruleId](context)) {
      findings.push({ ruleId, finding });
    }
  }

  const score = scoreFor(
    findings.map((entry) => entry.finding),
    context.words.length,
  );

  const diagnostics: Diagnostic[] = findings.map((entry) => ({
    ...entry.finding,
    ruleId: entry.ruleId,
    filePath,
  }));

  if (score >= BUNDLE_SCORE && options.rules === undefined) {
    diagnostics.push({
      ruleId: BUNDLE_RULE_ID,
      severity: 'error',
      message: `Prose slop score ${score}/100 across ${context.words.length} words — rewrite the flagged passages before publishing`,
      filePath,
      line: 1,
      column: 1,
    });
  }

  const metrics: ProseMetrics = {
    words: context.words.length,
    sentences: context.sentences.length,
    paragraphs: context.paragraphs.length,
    dashes: (context.text.match(/[—–]/g) ?? []).length,
    aiWords: diagnostics.filter((diagnostic) => diagnostic.ruleId === 'no-ai-vocabulary').length,
    score,
  };

  return { diagnostics, metrics };
}

export function scanProse(
  code: string,
  filePath: string,
  options: ProseSlopOptions = {},
): Diagnostic[] {
  if (SKIPPED_PATHS.test(filePath)) return [];
  return analyzeProse(code, filePath, options).diagnostics;
}

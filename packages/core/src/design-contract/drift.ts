import type { Diagnostic } from '../slop-scanner/types';
import { collectRegex, rawLocator, toColumn } from '../design-slop/utils';
import { isExemptColor, isExemptFont, isExemptRadius } from './exemptions';
import type { DesignContract, DriftFinding, DriftOptions } from './types';
import { DEFAULT_MINIMUM_OCCURRENCES } from './types';

// Drift is a value used often enough to be a deliberate choice, which the
// contract does not declare. Low-frequency values are incidental: a one-off
// `bg-slate-800` on a tooltip is not a design decision. That frequency gate is
// what keeps this rule from reporting every color in the project.

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;
const FUNCTION_COLOR = /\b(?:rgba?|hsla?|oklch)\([^)]*\)/g;
const TAILWIND_COLOR =
  /\b(?:bg|text|border|from|via|to|ring|shadow|fill|stroke|outline|decoration|divide|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g;
const FONT_FAMILY = /font-family\s*:\s*([^;}\n]+)/gi;
const RADIUS_CLASS = /\brounded(?:-[trbl]{1,2})?-\[(\d+)px\]/g;

function countOccurrences(code: string, pattern: RegExp): Map<string, { count: number; first: number }> {
  const counts = new Map<string, { count: number; first: number }>();
  for (const hit of collectRegex(code, pattern)) {
    const existing = counts.get(hit.match);
    if (existing) existing.count += 1;
    else counts.set(hit.match, { count: 1, first: hit.index });
  }
  return counts;
}

function tailwindFamily(token: string): string {
  const match = /^(?:bg|text|border|from|via|to|ring|shadow|fill|stroke|outline|decoration|divide|accent|caret)-([a-z]+)-\d+$/.exec(token);
  return match ? match[1] : token;
}

export function collectDrift(code: string, contract: DesignContract, options: DriftOptions = {}): DriftFinding[] {
  const minimum = options.minimumOccurrences ?? DEFAULT_MINIMUM_OCCURRENCES;
  const locator = rawLocator(code);
  const findings: DriftFinding[] = [];

  const colorGroups = [
    countOccurrences(code, HEX_COLOR),
    countOccurrences(code, FUNCTION_COLOR),
  ];
  for (const group of colorGroups) {
    for (const [value, { count, first }] of group) {
      if (count < minimum) continue;
      if (isExemptColor(contract, value)) continue;
      const position = toColumn(locator.getLineAndCharacterOfPosition(first));
      findings.push({
        kind: 'color',
        value,
        occurrences: count,
        message: `${value} appears ${count}x and no contract color declares it — either add it to DESIGN.md or use a declared token`,
        ...position,
      });
    }
  }

  for (const [value, { count, first }] of countOccurrences(code, TAILWIND_COLOR)) {
    if (count < minimum) continue;
    const family = tailwindFamily(value);
    if (isExemptFont(contract, family)) continue;
    const declaredFamily = [...contract.colors.keys()].some((token) => token.toLowerCase() === family);
    if (declaredFamily) continue;
    const position = toColumn(locator.getLineAndCharacterOfPosition(first));
    findings.push({
      kind: 'color',
      value,
      occurrences: count,
      message: `${value} appears ${count}x and no contract token declares it — declare the palette in DESIGN.md or reuse a token`,
      ...position,
    });
  }

  for (const match of code.matchAll(FONT_FAMILY)) {
    const declaration = match[1];
    const families = declaration.split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, ''));
    const undeclared = families.filter(
      (family) => family.length > 0 && !/^(?:system-ui|-apple-system|sans-serif|serif|monospace|ui-sans-serif|ui-monospace|inherit)$/i.test(family) && !isExemptFont(contract, family),
    );
    if (undeclared.length === 0) continue;
    const position = toColumn(locator.getLineAndCharacterOfPosition(match.index ?? 0));
    findings.push({
      kind: 'font',
      value: undeclared[0],
      occurrences: 1,
      message: `font-family uses ${undeclared.join(', ')} which the contract does not declare — add the family to DESIGN.md typography or use a declared token`,
      ...position,
    });
  }

  for (const [value, { count, first }] of countOccurrences(code, RADIUS_CLASS)) {
    if (count < minimum) continue;
    const pixels = value.match(/(\d+)px/)?.[1];
    if (pixels === undefined || isExemptRadius(contract, pixels)) continue;
    const position = toColumn(locator.getLineAndCharacterOfPosition(first));
    findings.push({
      kind: 'radius',
      value,
      occurrences: count,
      message: `radius ${pixels}px appears ${count}x and the contract declares no such value — add it to DESIGN.md rounded or use a declared token`,
      ...position,
    });
  }

  return findings;
}

export function scanDrift(code: string, filePath: string, contract: DesignContract, options: DriftOptions = {}): Diagnostic[] {
  return collectDrift(code, contract, options).map((finding) => ({
    ruleId: 'design-contract-drift',
    severity: 'error' as const,
    message: finding.message,
    filePath,
    line: finding.line,
    column: finding.column,
  }));
}

import type { DesignSlopRuleFn, Diagnostic } from '../types';
import { collectRegex, toColumn } from '../utils';

// Dark grey text on dark background — WCAG provable failure.
// 500-level muted grey on dark = 3.4-4.2:1 < 4.5:1 FAIL (error).
// 400-level = passes math (7:1) but APCA-weak (warning).
//
// Detection is scoped: a grey text class only counts when it sits inside a dark
// region (a JSX element subtree with a dark surface class, or a CSS rule whose
// declaration block sets a dark background). File-global matching produced
// errors for a grey caption in a light section of a file that also had one dark
// card, so the pairing is spatial now.

const DARK_SURFACE_CLASS =
  /\b(?:bg|from)-(?:slate|gray|neutral|zinc)-(?:900|950)\b|\bbg-black\b/g;

const DARK_HEX_DECL =
  /background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*[, ]\s*\d+\s*[, ]\s*\d+\s*\))/gi;

const GREY_TEXT = /\btext-(?:gray|slate|neutral|zinc)-(?:400|500|600|700|800|900)\b/g;

const TAG = /<(\/?)([A-Za-z][\w.]*)\b[^<>]*?(\/?)>/g;

function hexLuminance(hex: string): number | null {
  let body = hex.slice(1);
  if (body.length === 3) body = body.split('').map((character) => character + character).join('');
  if (body.length !== 6) return null;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(body.slice(offset, offset + 2), 16) / 255);
  const linear = (channel: number): number =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function rgbLuminance(declaration: string): number {
  const channels = declaration.match(/\d+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  const linear = (value: number): number => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(channels[0]) + 0.7152 * linear(channels[1]) + 0.0722 * linear(channels[2]);
}

interface Region {
  start: number;
  end: number;
}

/** Subtree spans of every JSX/HTML element whose className declares a dark surface. */
function darkMarkupRegions(code: string): Region[] {
  const regions: Region[] = [];
  const open: { name: string; start: number; dark: boolean }[] = [];

  for (const match of code.matchAll(TAG)) {
    const [tag, closing, name, selfClosing] = match;
    const index = match.index ?? 0;
    if (selfClosing === '/') continue;

    if (closing === '/') {
      for (let depth = open.length - 1; depth >= 0; depth -= 1) {
        if (open[depth].name !== name) continue;
        const [frame] = open.splice(depth, 1);
        if (frame.dark) regions.push({ start: frame.start, end: index + tag.length });
        break;
      }
      continue;
    }

    const className = /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/.exec(tag);
    const classes = className?.[1] ?? className?.[2] ?? className?.[3] ?? '';
    const dark = DARK_SURFACE_CLASS.test(classes);
    DARK_SURFACE_CLASS.lastIndex = 0;
    open.push({ name, start: index, dark });
  }

  return regions;
}

/** Declaration blocks whose background resolves darker than 15% luminance. */
function darkCssRegions(code: string): Region[] {
  const regions: Region[] = [];
  const block = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of code.matchAll(block)) {
    const declarations = match[2];
    for (const declaration of declarations.matchAll(DARK_HEX_DECL)) {
      const value = declaration[1];
      const luminance = value.startsWith('#')
        ? hexLuminance(value)
        : rgbLuminance(value);
      if (luminance === null || luminance >= 0.15) continue;
      const start = match.index ?? 0;
      regions.push({ start, end: start + match[0].length });
      break;
    }
  }
  return regions;
}

export const noDarkGreyText: DesignSlopRuleFn = (code, _filePath, locator) => {
  const regions = [...darkMarkupRegions(code), ...darkCssRegions(code)];
  if (regions.length === 0) return [];

  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];
  for (const hit of collectRegex(code, GREY_TEXT)) {
    if (!regions.some((region) => hit.index >= region.start && hit.index < region.end)) continue;

    const shade = parseInt(hit.match.match(/(\d{3})$/)?.[1] ?? '0', 10);
    if (shade < 400) continue;

    const loc = toColumn(locator.getLineAndCharacterOfPosition(hit.index));
    if (shade >= 500) {
      findings.push({
        severity: 'error',
        message: `Muted grey (${hit.match}) on a dark surface — WCAG AA contrast failure (~3.5-4.2:1 < 4.5:1); use text-slate-200/300 or #E2E8F0`,
        ...loc,
      });
    } else {
      findings.push({
        severity: 'warning',
        message: `Grey-400 (${hit.match}) on a dark surface — passes WCAG math but perceptually weak (APCA); prefer 300 for secondary text`,
        ...loc,
      });
    }
  }

  return findings;
};

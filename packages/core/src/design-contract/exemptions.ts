import { opaque } from './color';
import type { DesignContract, DesignExemptions } from './types';

function firstFamily(list: string): string {
  const [first] = list.split(',');
  return first.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
}

/**
 * The values a contract declares as intentional. A rule that would flag one of
 * these is wrong: the project chose it and wrote the choice down.
 */
export function getExemptions(contract: DesignContract): DesignExemptions {
  const colors = new Set<string>();
  for (const value of contract.colors.values()) {
    colors.add(opaque(value).toLowerCase());
    colors.add(value.toLowerCase());
  }

  const fonts = new Set<string>();
  for (const family of contract.typography.values()) {
    fonts.add(firstFamily(family));
    for (const part of family.split(',')) {
      fonts.add(part.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
    }
  }

  return {
    colors,
    fonts,
    radii: new Set(contract.rounded.values()),
  };
}

export function isExemptColor(contract: DesignContract | null, hex: string): boolean {
  if (contract === null) return false;
  const normalized = hex.toLowerCase();
  for (const value of contract.colors.values()) {
    const declared = value.toLowerCase();
    if (declared === normalized || opaque(declared) === opaque(normalized)) return true;
  }
  return false;
}

/** True when a contract token is named after the family, e.g. `indigo: "#6366f1"`. */
export function isExemptFamily(contract: DesignContract | null, family: string): boolean {
  if (contract === null) return false;
  const needle = family.toLowerCase();
  for (const token of contract.colors.keys()) {
    if (token.toLowerCase() === needle) return true;
  }
  return false;
}

export function isExemptFont(contract: DesignContract | null, family: string): boolean {
  if (contract === null) return false;
  const needle = family.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  for (const declared of contract.typography.values()) {
    if (firstFamily(declared) === needle) return true;
    if (declared.toLowerCase().split(',').some((part) => part.trim().replace(/^['"]|['"]$/g, '') === needle)) {
      return true;
    }
  }
  return false;
}

export function isExemptRadius(contract: DesignContract | null, pixels: string): boolean {
  if (contract === null) return false;
  return contract.rounded.has(pixels) || [...contract.rounded.values()].includes(pixels);
}

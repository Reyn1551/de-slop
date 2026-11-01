import { describe, expect, it } from 'vitest';
import { contrastRatio, normalizeColor, opaque, relativeLuminance } from './color';
import { collectDrift } from './drift';
import { isExemptColor, isExemptFont, isExemptRadius } from './exemptions';
import { isContractParseError, parseDesignContract } from './parser';
import { scanDrift } from './drift';

const CONTRACT = `---
version: alpha
colors:
  primary: "#0EA5E9"
  surface: "#0B0B0B"
  accent: "oklch(0.72 0.15 250)"
typography:
  sans:
    fontFamily: "Inter, system-ui, sans-serif"
  display:
    fontFamily: "Playfair Display, serif"
rounded:
  md: 8px
  lg: 16px
omitted:
  - spacing
---
# Design

Declared tokens only.
`;

function parseOrThrow(code: string, path = 'DESIGN.md') {
  const parsed = parseDesignContract(code, path);
  if (isContractParseError(parsed)) throw new Error(parsed.message);
  return parsed;
}

describe('normalizeColor', () => {
  it('expands short hex', () => {
    expect(normalizeColor('#0af')).toBe('#00aaff');
  });

  it('keeps alpha hex', () => {
    expect(normalizeColor('#0ea5e980')).toBe('#0ea5e980');
  });

  it('parses rgb and rgba', () => {
    expect(normalizeColor('rgb(14, 165, 233)')).toBe('#0ea5e9');
    expect(normalizeColor('rgba(14, 165, 233, 0.5)')).toBe('#0ea5e980');
  });

  it('parses hsl', () => {
    expect(normalizeColor('hsl(0, 100%, 50%)')).toBe('#ff0000');
  });

  it('parses oklch', () => {
    const value = normalizeColor('oklch(0.72 0.15 250)');
    expect(value).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('parses named colors', () => {
    expect(normalizeColor('white')).toBe('#ffffff');
    expect(normalizeColor('BLACK')).toBe('#000000');
  });

  it('rejects nonsense', () => {
    expect(normalizeColor('not-a-color')).toBeNull();
  });
});

describe('contrast', () => {
  it('computes black on white as 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('computes identical colors as 1:1', () => {
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('orders luminance correctly', () => {
    expect(relativeLuminance('#ffffff')).toBeGreaterThan(relativeLuminance('#000000'));
  });

  it('strips alpha for comparison', () => {
    expect(opaque('#0ea5e980')).toBe('#0ea5e9');
  });
});

describe('parseDesignContract', () => {
  it('parses colors, typography, radius, and omitted', () => {
    const contract = parseOrThrow(CONTRACT);
    expect(contract.version).toBe('alpha');
    expect(contract.colors.get('primary')).toBe('#0ea5e9');
    expect(contract.colors.get('surface')).toBe('#0b0b0b');
    expect(contract.colors.get('accent')).toMatch(/^#[0-9a-f]{6}$/);
    expect(contract.typography.get('sans')).toContain('Inter');
    expect(contract.rounded.get('md')).toBe('8');
    expect(contract.omitted).toEqual(['spacing']);
  });

  it('rejects a file with no frontmatter', () => {
    const parsed = parseDesignContract('# Design\n', 'DESIGN.md');
    expect(isContractParseError(parsed)).toBe(true);
  });

  it('rejects an unparseable color', () => {
    const parsed = parseDesignContract('---\ncolors:\n  primary: not-a-color\n---\n', 'DESIGN.md');
    expect(isContractParseError(parsed)).toBe(true);
  });

  it('rejects a non-pixel radius', () => {
    const parsed = parseDesignContract('---\nrounded:\n  md: 50%\n---\n', 'DESIGN.md');
    expect(isContractParseError(parsed)).toBe(true);
  });

  it('ignores comments and blank lines', () => {
    const contract = parseOrThrow('---\n# header\ncolors:\n  primary: "#123456"  # blue\n\n---\n');
    expect(contract.colors.get('primary')).toBe('#123456');
  });

  it('defaults version when absent', () => {
    expect(parseOrThrow('---\ncolors:\n  a: "#000000"\n---\n').version).toBe('unknown');
  });
});

describe('exemptions', () => {
  const contract = parseOrThrow(CONTRACT);

  it('exempts declared colors by hex and by family', () => {
    expect(isExemptColor(contract, '#0EA5E9')).toBe(true);
    expect(isExemptColor(contract, '#0ea5e980')).toBe(true);
    expect(isExemptColor(contract, '#ff0000')).toBe(false);
  });

  it('exempts declared fonts', () => {
    expect(isExemptFont(contract, 'Inter')).toBe(true);
    expect(isExemptFont(contract, 'Playfair Display')).toBe(true);
    expect(isExemptFont(contract, 'Comic Sans')).toBe(false);
  });

  it('exempts declared radii', () => {
    expect(isExemptRadius(contract, '8')).toBe(true);
    expect(isExemptRadius(contract, '12')).toBe(false);
  });

  it('exempts nothing without a contract', () => {
    expect(isExemptColor(null, '#0EA5E9')).toBe(false);
    expect(isExemptFont(null, 'Inter')).toBe(false);
    expect(isExemptRadius(null, '8')).toBe(false);
  });
});

describe('drift', () => {
  const contract = parseOrThrow(CONTRACT);

  it('flags a repeated undeclared hex', () => {
    const code = '.a { color: #ff0000; }\n.b { color: #ff0000; }\n.c { color: #ff0000; }\n';
    const findings = collectDrift(code, contract);
    expect(findings.some((finding) => finding.value === '#ff0000')).toBe(true);
  });

  it('accepts a declared hex used many times', () => {
    const code = '.a { color: #0EA5E9; }\n.b { color: #0EA5E9; }\n.c { color: #0EA5E9; }\n';
    expect(collectDrift(code, contract)).toEqual([]);
  });

  it('ignores low-frequency values', () => {
    const code = '.a { color: #ff0000; }\n';
    expect(collectDrift(code, contract)).toEqual([]);
  });

  it('flags a repeated undeclared Tailwind color', () => {
    const code = '<a className="bg-rose-500" /><b className="bg-rose-500" /><c className="bg-rose-500" />';
    const findings = collectDrift(code, contract);
    expect(findings.some((finding) => finding.value === 'bg-rose-500')).toBe(true);
  });

  it('flags an undeclared font family', () => {
    const code = 'body { font-family: "Comic Sans MS", cursive; }\n';
    const findings = collectDrift(code, contract);
    expect(findings.some((finding) => finding.kind === 'font')).toBe(true);
  });

  it('accepts a declared font family', () => {
    const code = 'body { font-family: Inter, system-ui, sans-serif; }\n';
    expect(collectDrift(code, contract)).toEqual([]);
  });

  it('flags a repeated undeclared radius', () => {
    const code = '<a className="rounded-[13px]" /><b className="rounded-[13px]" /><c className="rounded-[13px]" />';
    const findings = collectDrift(code, contract);
    expect(findings.some((finding) => finding.kind === 'radius')).toBe(true);
  });

  it('accepts a declared radius', () => {
    const code = '<a className="rounded-[8px]" /><b className="rounded-[8px]" /><c className="rounded-[8px]" />';
    expect(collectDrift(code, contract)).toEqual([]);
  });

  it('reports positions', () => {
    const code = '.a { color: #ff0000; }\n.b { color: #ff0000; }\n.c { color: #ff0000; }\n';
    for (const finding of collectDrift(code, contract)) {
      expect(finding.line).toBeGreaterThan(0);
      expect(finding.column).toBeGreaterThan(0);
    }
  });

  it('scanDrift emits error diagnostics with the drift rule id', () => {
    const code = '.a { color: #ff0000; }\n.b { color: #ff0000; }\n.c { color: #ff0000; }\n';
    const diagnostics = scanDrift(code, 'src/theme.css', contract);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.every((diagnostic) => diagnostic.ruleId === 'design-contract-drift')).toBe(true);
    expect(diagnostics.every((diagnostic) => diagnostic.severity === 'error')).toBe(true);
    expect(diagnostics.every((diagnostic) => diagnostic.filePath === 'src/theme.css')).toBe(true);
  });

  it('respects a custom occurrence threshold', () => {
    const code = '.a { color: #ff0000; }\n';
    expect(collectDrift(code, contract, { minimumOccurrences: 1 }).length).toBeGreaterThan(0);
  });
});

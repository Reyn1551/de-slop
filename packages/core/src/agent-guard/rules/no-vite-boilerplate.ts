import type { Diagnostic } from '../types';

const VITE_BOILERPLATE_MARKERS = [
  'This template provides a minimal setup',
  'React + TypeScript + Vite',
  'Currently, two official plugins are available',
  '@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react',
  '@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react',
  'React Compiler is not enabled on this template',
  'Expanding the Oxlint configuration',
  'oxlint-tsgolint',
];

export function noViteBoilerplate(
  code: string,
  filePath: string,
  locator: { getLineAndCharacterOfPosition(pos: number): { line: number; character: number } },
): Omit<Diagnostic, 'filePath' | 'ruleId'>[] {
  if (!/\.(md|mdx|txt|rst)$/i.test(filePath)) return [];
  if (!filePath.toLowerCase().endsWith('readme.md')) return [];

  const findings: Omit<Diagnostic, 'filePath' | 'ruleId'>[] = [];

  for (const marker of VITE_BOILERPLATE_MARKERS) {
    const idx = code.indexOf(marker);
    if (idx !== -1) {
      const loc = locator.getLineAndCharacterOfPosition(idx);
      findings.push({
        severity: 'error',
        message: `README still contains Vite boilerplate text: "${marker.slice(0, 50)}..." — replace with project-specific documentation.`,
        line: loc.line + 1,
        column: loc.character + 1,
      });
    }
  }

  return findings;
}
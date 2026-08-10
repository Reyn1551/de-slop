import type { TextLocator } from './types';

export function rawLocator(code: string): TextLocator {
  const lines = code.split('\n');
  return {
    getLineAndCharacterOfPosition(pos: number) {
      let line = 0;
      while (line < lines.length - 1 && pos >= lines[line].length + 1) {
        pos -= lines[line].length + 1;
        line++;
      }
      return { line, character: Math.max(0, pos) };
    },
  };
}

export function toColumn(loc: { line: number; character: number }): { line: number; column: number } {
  return { line: loc.line + 1, column: loc.character + 1 };
}

export interface MatchWithIndex {
  match: string;
  index: number;
}

export function collectRegex(code: string, pattern: RegExp): MatchWithIndex[] {
  const results: MatchWithIndex[] = [];
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  for (const m of code.matchAll(global)) {
    results.push({ match: m[0], index: m.index ?? 0 });
  }
  return results;
}

export function countRegex(code: string, pattern: RegExp): number {
  return collectRegex(code, pattern).length;
}

import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyzeFile, analyzeProject } from './analyze';
import {
  AGENT_EROSION_BASELINE,
  AGENT_VERBOSITY_BASELINE,
  HUMAN_EROSION_BASELINE,
  HUMAN_VERBOSITY_BASELINE,
  compareBaseline,
  loadBaseline,
  saveBaseline,
} from './baseline';
import type { ProjectMetrics } from './types';

const NESTED_FUNCTION = `function nested(a: number, b: number): number {
  let total = 0;
  if (a > 0) {
    if (b > 0) {
      total += 1;
    } else {
      total += 2;
    }
  } else {
    if (b > 0) {
      total += 3;
    }
  }
  if (a > 10) {
    total += 4;
  }
  if (b > 10) {
    total += 5;
  }
  if (a === b) {
    total += 6;
  }
  if (a + b > 20) {
    total += 7;
  }
  if (a - b > 5) {
    total += 8;
  }
  if (a * b > 30) {
    total += 9;
  }
  if (a / 2 > 1) {
    total += 10;
  }
  if (a % 2 === 0) {
    total += 11;
  }
  if (total > 100) {
    total -= 100;
  }
  return total;
}
`;

const DUPLICATED_BLOCK = `  const rows: number[] = [];
  for (let i = 0; i < 4; i++) {
    rows.push(i * 2);
    rows.push(i * 3);
  }
  const scaled = rows.map((value) => value + 1);
  const filtered = scaled.filter((value) => value > 2);
  const sorted = filtered.sort((a, b) => a - b);
  return sorted;
`;

const DUPLICATE_FILE = `function first(): number[] {
${DUPLICATED_BLOCK}}
function second(): number[] {
${DUPLICATED_BLOCK}}
`;

const CLEAN_FILE = `function add(a: number, b: number): number {
  const sum = a + b;
  return sum;
}

export function twice(n: number): number {
  return add(n, n);
}

export const NAME = 'degradation';
`;

function projectOf(erosion: number, verbosity: number, loc = 100): ProjectMetrics {
  return { files: [], loc, sloc: loc, functionCount: 1, erosion, verbosity };
}

function flaggedOf(code: string): number[] {
  return analyzeFile(code, 'sample.ts').flaggedLines;
}

describe('analyzeFile cyclomatic complexity', () => {
  it('counts each branch in a 3-branch function as CC 4', () => {
    const metrics = analyzeFile(
      `function classify(n: number): string {
  if (n < 0) {
    return 'negative';
  }
  if (n === 0) {
    return 'zero';
  }
  if (n > 10) {
    return 'large';
  }
  return 'small';
}
`,
      'classify.ts',
    );

    expect(metrics.functions).toHaveLength(1);
    expect(metrics.functions[0].cyclomatic).toBe(4);
    expect(metrics.functions[0].name).toBe('classify');
    expect(metrics.maxCyclomatic).toBe(4);
  });

  it('counts logical, nullish, optional chain and conditional operators', () => {
    const metrics = analyzeFile(
      `function pick(a: number, b: number, c: { v?: number }): number {
  const first = a && b ? a : b;
  const second = c?.v ?? 0;
  return first || second;
}
`,
      'ops.ts',
    );

    expect(metrics.functions[0].cyclomatic).toBe(6);
  });

  it('does not fold nested declarations into the outer function but counts nested arrows', () => {
    const metrics = analyzeFile(
      `function outer(items: number[]): number {
  function inner(a: number): number {
    if (a > 0) {
      return a;
    }
    return 0;
  }
  return items.map((item) => (item > 1 ? inner(item) : 0)).length;
}
`,
      'nested.ts',
    );

    const outer = metrics.functions.find((fn) => fn.name === 'outer');
    const inner = metrics.functions.find((fn) => fn.name === 'inner');
    expect(outer?.cyclomatic).toBe(1);
    expect(inner?.cyclomatic).toBe(2);
    expect(metrics.functions).toHaveLength(3);
    expect(metrics.functions.filter((fn) => fn.name === '<anonymous>')).toHaveLength(1);
  });

  it('skips declarations without a body', () => {
    const metrics = analyzeFile(
      `function parse(value: string): number;
function parse(value: number): number;
function parse(value: string | number): number {
  return Number(value);
}
`,
      'overload.ts',
    );

    expect(metrics.functions).toHaveLength(1);
    expect(metrics.functions[0].name).toBe('parse');
  });

  it('names methods and constructors', () => {
    const metrics = analyzeFile(
      `class Counter {
  constructor(private start: number) {
    this.start = start;
  }

  bump(step: number): number {
    return this.start + step;
  }
}
`,
      'counter.ts',
    );

    expect(metrics.functions.map((fn) => fn.name)).toEqual(['constructor', 'bump']);
  });

  it('excludes comment-only lines from sloc but keeps template literal lines', () => {
    const metrics = analyzeFile(
      `/**
 * Docs.
 */
function documented(value: number): number {
  // inline comment
  const text = \`
    template line
  \`;
  return value + text.length;
}
`,
      'documented.ts',
    );

    expect(metrics.loc).toBe(10);
    expect(metrics.sloc).toBe(6);
    expect(metrics.functions[0].sloc).toBe(6);
  });

  it('reports mass as cyclomatic * sqrt(sloc)', () => {
    const metrics = analyzeFile(
      `function add(a: number, b: number): number {
  const sum = a + b;
  return sum;
}
`,
      'mass.ts',
    );

    const fn = metrics.functions[0];
    expect(fn.sloc).toBe(4);
    expect(fn.mass).toBeCloseTo(fn.cyclomatic * Math.sqrt(fn.sloc), 10);
  });
});

describe('analyzeFile erosion', () => {
  it('reports erosion above 0.8 for one deeply nested 40-line function', () => {
    const metrics = analyzeFile(NESTED_FUNCTION, 'nested.ts');

    expect(metrics.loc).toBeGreaterThanOrEqual(40);
    expect(metrics.functions).toHaveLength(1);
    expect(metrics.functions[0].cyclomatic).toBeGreaterThan(10);
    expect(metrics.erosion).toBeGreaterThan(0.8);
  });

  it('reports zero erosion for tiny pure functions', () => {
    const metrics = analyzeFile(
      `function add(a: number, b: number): number {
  return a + b;
}

function double(n: number): number {
  return n * 2;
}
`,
      'pure.ts',
    );

    expect(metrics.functions).toHaveLength(2);
    expect(metrics.erosion).toBe(0);
  });

  it('reports zero erosion for a file without functions', () => {
    expect(analyzeFile('export const VALUE = 1;\n', 'const.ts').erosion).toBe(0);
  });
});

describe('analyzeFile clone lines', () => {
  it('marks every line of a duplicated 5+ line block', () => {
    const metrics = analyzeFile(DUPLICATE_FILE, 'dup.ts');

    expect(metrics.cloneLines.length).toBeGreaterThanOrEqual(8);
    expect(metrics.cloneLines).toContain(3);
    expect(metrics.cloneLines).toContain(13);
    expect(metrics.cloneLines.every((line) => line >= 1 && line <= metrics.loc)).toBe(true);
  });

  it('does not mark lines without duplication', () => {
    expect(analyzeFile(CLEAN_FILE, 'clean.ts').cloneLines).toEqual([]);
  });

  it('divides the flagged and clone union by loc', () => {
    const metrics = analyzeFile(DUPLICATE_FILE, 'dup.ts');
    const union = new Set([...metrics.flaggedLines, ...metrics.cloneLines]);

    expect(metrics.verbosity).toBeCloseTo(union.size / metrics.loc, 10);
  });
});

describe('analyzeFile flagged verbose constructs', () => {
  it('flags return await', () => {
    expect(flaggedOf(`async function load(): Promise<number> {\n  return await read();\n}\n`)).toEqual([2]);
  });

  it('flags comparisons against boolean literals', () => {
    expect(flaggedOf(`function check(flag: boolean): boolean {\n  return flag === true;\n}\n`)).toEqual([2]);
    expect(flaggedOf(`function check(flag: boolean): boolean {\n  return flag !== false;\n}\n`)).toEqual([2]);
    expect(flaggedOf(`function check(flag: boolean): boolean {\n  return flag === false;\n}\n`)).toEqual([2]);
    expect(flaggedOf(`function check(flag: boolean): boolean {\n  return flag !== true;\n}\n`)).toEqual([2]);
  });

  it('flags if/else returning boolean literals', () => {
    const code = `function isReady(flag: boolean): boolean {
  if (flag) {
    return true;
  } else {
    return false;
  }
}
`;
    expect(flaggedOf(code)).toEqual([2]);
  });

  it('flags length comparisons used as ternaries', () => {
    const code = `function pick(items: number[]): number {
  return items.length > 0 ? items[0] : 0;
}
`;
    expect(flaggedOf(code)).toEqual([2]);
  });

  it('flags an empty else block', () => {
    const code = `function run(value: number): void {
  if (value > 0) {
    value += 1;
  } else {
  }
}
`;
    expect(flaggedOf(code)).toEqual([2]);
  });

  it('flags else { return } after a return', () => {
    const code = `function guard(value: number): void {
  if (value > 0) {
    return;
  } else {
    return;
  }
}
`;
    expect(flaggedOf(code)).toEqual([2]);
  });

  it('flags String() around a template literal', () => {
    const code = `function label(value: number): string {
  return String(\`value: \${value}\`);
}
`;
    expect(flaggedOf(code)).toEqual([2]);
  });

  it('flags await Promise.resolve', () => {
    const code = `async function settle(): Promise<number> {
  return await Promise.resolve(1);
}
`;
    expect(flaggedOf(code)).toContain(2);
  });

  it('flags typeof undefined checks', () => {
    const code = `function has(value: unknown): boolean {
  return typeof value !== 'undefined';
}
`;
    expect(flaggedOf(code)).toEqual([2]);
  });

  it('flags Array.from(...).map(...)', () => {
    const code = `function upper(values: string[]): string[] {
  return Array.from(values).map((item) => item.toUpperCase());
}
`;
    expect(flaggedOf(code)).toEqual([2]);
  });

  it('flags nothing in a clean 10-line file and reports zero verbosity', () => {
    const metrics = analyzeFile(CLEAN_FILE, 'clean.ts');

    expect(metrics.loc).toBe(10);
    expect(metrics.sloc).toBe(8);
    expect(metrics.flaggedLines).toEqual([]);
    expect(metrics.cloneLines).toEqual([]);
    expect(metrics.verbosity).toBe(0);
  });
});

describe('analyzeProject', () => {
  it('sums masses across files instead of averaging ratios', () => {
    const eroded = analyzeFile(NESTED_FUNCTION, 'eroded.ts');
    const clean = analyzeFile(CLEAN_FILE, 'clean.ts');
    const project = analyzeProject([
      { filePath: 'eroded.ts', code: NESTED_FUNCTION },
      { filePath: 'clean.ts', code: CLEAN_FILE },
    ]);

    const totalMass = [...eroded.functions, ...clean.functions].reduce((sum, fn) => sum + fn.mass, 0);
    const erodedMass = eroded.functions.reduce((sum, fn) => sum + fn.mass, 0);

    expect(project.files).toHaveLength(2);
    expect(project.erosion).toBeCloseTo(erodedMass / totalMass, 10);
    expect(project.erosion).toBeGreaterThan(clean.erosion);
    expect(project.erosion).toBeLessThan(eroded.erosion);
    expect(project.loc).toBe(eroded.loc + clean.loc);
    expect(project.sloc).toBe(eroded.sloc + clean.sloc);
    expect(project.functionCount).toBe(eroded.functions.length + clean.functions.length);
  });

  it('aggregates verbosity over summed loc', () => {
    const first = analyzeFile(DUPLICATE_FILE, 'dup.ts');
    const second = analyzeFile(CLEAN_FILE, 'clean.ts');
    const project = analyzeProject([
      { filePath: 'dup.ts', code: DUPLICATE_FILE },
      { filePath: 'clean.ts', code: CLEAN_FILE },
    ]);

    const verbose = new Set([...first.flaggedLines, ...first.cloneLines]).size;
    expect(project.verbosity).toBeCloseTo(verbose / (first.loc + second.loc), 10);
  });
});

describe('compareBaseline', () => {
  it('reports degradation when erosion rises 0.05', () => {
    const delta = compareBaseline(projectOf(0.73, 0.44), projectOf(0.68, 0.44));

    expect(delta.degrading).toBe(true);
    expect(delta.erosion).toBeCloseTo(0.05, 10);
    expect(delta.reasons[0]).toContain('erosion');
    expect(delta.reasons[0]).toContain('+0.050');
  });

  it('does not report degradation when erosion falls', () => {
    const delta = compareBaseline(projectOf(0.51, 0.44), projectOf(0.68, 0.44));

    expect(delta.degrading).toBe(false);
    expect(delta.reasons).toEqual([]);
    expect(delta.erosion).toBeCloseTo(-0.17, 10);
  });

  it('ignores movement within the default tolerance', () => {
    expect(compareBaseline(projectOf(0.69, 0.45), projectOf(0.68, 0.44)).degrading).toBe(false);
  });

  it('honours a custom tolerance', () => {
    const delta = compareBaseline(projectOf(0.73, 0.44), projectOf(0.68, 0.44), 0.1);

    expect(delta.degrading).toBe(false);
    expect(delta.reasons).toEqual([]);
  });

  it('reports verbosity degradation with 3 decimals', () => {
    const delta = compareBaseline(projectOf(0.68, 0.55), projectOf(0.68, 0.44));

    expect(delta.degrading).toBe(true);
    expect(delta.reasons).toEqual(['verbosity rose +0.110 (0.440 -> 0.550)']);
  });

  it('tracks loc deltas', () => {
    expect(compareBaseline(projectOf(0.68, 0.44, 120), projectOf(0.68, 0.44, 100)).loc).toBe(20);
  });

  it('exposes the published baselines', () => {
    expect(HUMAN_EROSION_BASELINE).toBe(0.34);
    expect(HUMAN_VERBOSITY_BASELINE).toBe(0.19);
    expect(AGENT_EROSION_BASELINE).toBe(0.68);
    expect(AGENT_VERBOSITY_BASELINE).toBe(0.44);
  });
});

describe('baseline persistence', () => {
  it('round-trips metrics through a temp directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'degradation-'));
    try {
      const path = join(dir, 'nested', 'baseline.json');
      const metrics = analyzeProject([{ filePath: 'nested.ts', code: NESTED_FUNCTION }]);

      await saveBaseline(path, metrics);

      const raw = await readFile(path, 'utf8');
      expect(raw.startsWith('{\n  "files"')).toBe(true);
      expect(await loadBaseline(path)).toEqual(metrics);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns null for a missing file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'degradation-'));
    try {
      expect(await loadBaseline(join(dir, 'absent.json'))).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('returns null for malformed content', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'degradation-'));
    try {
      const path = join(dir, 'baseline.json');
      await writeFile(path, '{ not json', 'utf8');
      expect(await loadBaseline(path)).toBeNull();

      await writeFile(path, JSON.stringify({ files: [] }), 'utf8');
      expect(await loadBaseline(path)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

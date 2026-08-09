import { createHash } from 'node:crypto';
import { parseSourceFile } from '../slop-scanner/scanner.js';
import { extractTests } from './extract.js';
import type { TestFileFingerprint } from './types.js';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintTests(code: string, filePath: string): TestFileFingerprint {
  const sourceFile = parseSourceFile(code, filePath);
  const tests = extractTests(sourceFile);
  const hash = createHash('sha256').update(stableStringify({ tests })).digest('hex');
  const assertionCount = tests.reduce((sum, testCase) => sum + testCase.assertions.length, 0);
  return { filePath, hash, testCount: tests.length, assertionCount, tests };
}

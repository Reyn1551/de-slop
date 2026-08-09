import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fingerprintTests } from './fingerprint.js';
import { verifyTests } from './verify.js';
import type { TestFileFingerprint, TestViolation } from './types.js';

export const DEFAULT_STORE_PATH = '.de-slop/test-lock.json';

type TestLockStore = Record<string, TestFileFingerprint>;

function loadStore(storePath: string): TestLockStore {
  try {
    return JSON.parse(readFileSync(storePath, 'utf8')) as TestLockStore;
  } catch {
    return {};
  }
}

function writeStore(storePath: string, store: TestLockStore): void {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export function lockTestFile(filePath: string, storePath = DEFAULT_STORE_PATH): TestFileFingerprint {
  const code = readFileSync(filePath, 'utf8');
  const fingerprint = fingerprintTests(code, filePath);
  const store = loadStore(storePath);
  store[filePath] = fingerprint;
  writeStore(storePath, store);
  return fingerprint;
}

export function verifyTestFile(filePath: string, storePath = DEFAULT_STORE_PATH): TestViolation[] {
  const store = loadStore(storePath);
  const before = store[filePath];
  if (!before) return [];
  const code = readFileSync(filePath, 'utf8');
  return verifyTests(before, fingerprintTests(code, filePath));
}

export interface AssertionInfo {
  kind: string; // 'expect' | 'assert' | 'assertEquals' dst — nama callee teratas
  argsShape: string; // bentuk AST ternormalisasi dari argumen (literal diganti tipe: <num>, <str>, <bool>)
  line: number;
}

export interface TestCaseInfo {
  name: string; // judul it/test
  kind: 'it' | 'test' | 'describe';
  skipped: boolean; // .skip atau xit/xtest
  assertions: AssertionInfo[];
  line: number;
  mockCalls: number;
  statements: number;
}

export interface TestFileFingerprint {
  filePath: string;
  hash: string; // sha256 dari struktur ternormalisasi
  testCount: number;
  assertionCount: number;
  tests: TestCaseInfo[];
}

export interface TestViolation {
  type: 'test-removed' | 'test-skipped' | 'assertion-weakened' | 'assertion-removed' | 'over-mocking';
  message: string;
  testName?: string;
  line?: number;
}

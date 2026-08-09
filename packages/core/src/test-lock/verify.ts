import type { TestCaseInfo, TestFileFingerprint, TestViolation } from './types.js';

const OVER_MOCKING_RATIO = 0.7;

function indexByKey(tests: TestCaseInfo[]): Map<string, TestCaseInfo[]> {
  const index = new Map<string, TestCaseInfo[]>();
  for (const testCase of tests) {
    const key = `${testCase.kind}:${testCase.name}`;
    const bucket = index.get(key);
    if (bucket) bucket.push(testCase);
    else index.set(key, [testCase]);
  }
  return index;
}

function mockRatio(testCase: TestCaseInfo): number {
  if (testCase.statements === 0) return 0;
  return testCase.mockCalls / testCase.statements;
}

function compareTests(beforeTest: TestCaseInfo, afterTest: TestCaseInfo, violations: TestViolation[]): void {
  if (!beforeTest.skipped && afterTest.skipped) {
    violations.push({
      type: 'test-skipped',
      message: `Test '${afterTest.name}' is now skipped`,
      testName: afterTest.name,
      line: afterTest.line,
    });
  }

  if (afterTest.assertions.length < beforeTest.assertions.length) {
    violations.push({
      type: 'assertion-removed',
      message: `Assertion count dropped in test '${afterTest.name}' (${beforeTest.assertions.length} -> ${afterTest.assertions.length})`,
      testName: afterTest.name,
      line: afterTest.line,
    });
  }

  const comparable = Math.min(beforeTest.assertions.length, afterTest.assertions.length);
  for (let index = 0; index < comparable; index++) {
    const beforeAssertion = beforeTest.assertions[index];
    const afterAssertion = afterTest.assertions[index];
    if (beforeAssertion.kind === afterAssertion.kind && beforeAssertion.argsShape !== afterAssertion.argsShape) {
      violations.push({
        type: 'assertion-weakened',
        message: `Assertion '${afterAssertion.kind}' changed in test '${afterTest.name}'`,
        testName: afterTest.name,
        line: afterAssertion.line,
      });
    }
  }

  const beforeRatio = mockRatio(beforeTest);
  const afterRatio = mockRatio(afterTest);
  if (afterRatio > OVER_MOCKING_RATIO && beforeRatio <= OVER_MOCKING_RATIO) {
    violations.push({
      type: 'over-mocking',
      message: `Test '${afterTest.name}' consists of more than 70% mock calls`,
      testName: afterTest.name,
      line: afterTest.line,
    });
  }
}

export function verifyTests(before: TestFileFingerprint, after: TestFileFingerprint): TestViolation[] {
  const violations: TestViolation[] = [];
  const beforeByKey = indexByKey(before.tests);
  const afterByKey = indexByKey(after.tests);

  for (const [key, beforeTests] of beforeByKey) {
    const afterTests = afterByKey.get(key) ?? [];
    for (let index = 0; index < beforeTests.length; index++) {
      const beforeTest = beforeTests[index];
      const afterTest = afterTests[index];
      if (!afterTest) {
        violations.push({
          type: 'test-removed',
          message: `Test '${beforeTest.name}' was removed`,
          testName: beforeTest.name,
          line: beforeTest.line,
        });
        continue;
      }
      compareTests(beforeTest, afterTest, violations);
    }
  }
  return violations;
}

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { fingerprintTests } from './fingerprint';
import { verifyTests, verifyAssertionQuality } from './verify';
import { lockTestFile, verifyTestFile } from './store';

const BASE_SOURCE = [
  "import { describe, it, expect, assert, t } from 'vitest';",
  '',
  "describe('math', () => {",
  "  it('adds numbers', () => {",
  '    const result = add(1, 2);',
  '    expect(result).toBe(3);',
  '  });',
  "  it('handles negatives', () => {",
  '    expect(add(-1, -2)).toBe(-3);',
  '  });',
  "  test('legacy test', () => {",
  '    assert.equal(add(2, 2), 4);',
  '    t.is(add(1, 1), 2);',
  '  });',
  '});',
  '',
].join('\n');

describe('fingerprintTests', () => {
  test('same source produces same hash and counts', () => {
    const first = fingerprintTests(BASE_SOURCE, 'math.test.ts');
    const second = fingerprintTests(BASE_SOURCE, 'math.test.ts');

    expect(first.hash).toBe(second.hash);
    expect(first.hash).toHaveLength(64);
    expect(first.testCount).toBe(4);
    expect(first.assertionCount).toBe(4);
  });

  test('different source produces different hash', () => {
    const original = fingerprintTests(BASE_SOURCE, 'math.test.ts');
    const modified = fingerprintTests(
      BASE_SOURCE.replace('expect(result).toBe(3);', 'expect(result).toBe(30);'),
      'math.test.ts',
    );

    expect(original.hash).not.toBe(modified.hash);
  });

  test('tracks skip variants, kinds and matcher shape', () => {
    const fp = fingerprintTests(
      [
        "it('a', () => { expect(1).toBe(1); });",
        "xit('b', () => {});",
        "it.skip('c', () => {});",
        "it.only('d', () => { expect(2).toBe(2); });",
      ].join('\n'),
      'skips.test.ts',
    );

    const byName = Object.fromEntries(fp.tests.map((testCase) => [testCase.name, testCase]));
    expect(byName['a'].kind).toBe('it');
    expect(byName['a'].skipped).toBe(false);
    expect(byName['b'].skipped).toBe(true);
    expect(byName['c'].skipped).toBe(true);
    expect(byName['d'].skipped).toBe(false);
    expect(byName['a'].assertions[0].kind).toBe('expect');
    expect(byName['a'].assertions[0].argsShape).toBe('expect(num:1).toBe(num:1)');
    expect(byName['b'].assertions).toEqual([]);
  });
});

describe('verifyTests', () => {
  test('clean pass reports no violations', () => {
    const fp = fingerprintTests(BASE_SOURCE, 'math.test.ts');

    expect(verifyTests(fp, fingerprintTests(BASE_SOURCE, 'math.test.ts'))).toEqual([]);
  });

  test('detects removed test', () => {
    const before = fingerprintTests(BASE_SOURCE, 'math.test.ts');
    const afterSource = BASE_SOURCE.replace("it('handles negatives'", "it('handles positives'");

    const violations = verifyTests(before, fingerprintTests(afterSource, 'math.test.ts'));

    expect(violations).toContainEqual(
      expect.objectContaining({ type: 'test-removed', testName: 'handles negatives' }),
    );
  });

  test('detects test skipped', () => {
    const before = fingerprintTests(BASE_SOURCE, 'math.test.ts');
    const afterSource = BASE_SOURCE.replace("it('adds numbers'", "it.skip('adds numbers'");

    const violations = verifyTests(before, fingerprintTests(afterSource, 'math.test.ts'));

    expect(violations).toContainEqual(
      expect.objectContaining({ type: 'test-skipped', testName: 'adds numbers' }),
    );
  });

  test('detects weakened assertion', () => {
    const before = fingerprintTests(BASE_SOURCE, 'math.test.ts');
    const afterSource = BASE_SOURCE.replace('expect(result).toBe(3);', 'expect(result).toBe(2);');

    const violations = verifyTests(before, fingerprintTests(afterSource, 'math.test.ts'));

    expect(violations).toContainEqual(
      expect.objectContaining({ type: 'assertion-weakened', testName: 'adds numbers' }),
    );
  });

  test('detects removed assertion', () => {
    const before = fingerprintTests(BASE_SOURCE, 'math.test.ts');
    const afterSource = BASE_SOURCE.replace('    expect(result).toBe(3);\n', '');

    const violations = verifyTests(before, fingerprintTests(afterSource, 'math.test.ts'));

    expect(violations).toContainEqual(
      expect.objectContaining({ type: 'assertion-removed', testName: 'adds numbers' }),
    );
  });

  test('detects over-mocking', () => {
    const before = fingerprintTests(
      "it('uses mocks', () => { const fn = vi.fn(); fn(); expect(fn).toHaveBeenCalledTimes(1); });",
      'mocks.test.ts',
    );
    const after = fingerprintTests(
      [
        "it('uses mocks', () => {",
        "  vi.mock('module-a');",
        "  vi.mock('module-b');",
        "  vi.mock('module-c');",
        '  expect(1).toBe(1);',
        '});',
      ].join('\n'),
      'mocks.test.ts',
    );

    const violations = verifyTests(before, after);

    expect(violations).toContainEqual(
      expect.objectContaining({ type: 'over-mocking', testName: 'uses mocks' }),
    );
  });
});

describe('verifyAssertionQuality', () => {
  test('detects trivial assertion expect(true).toBe(true)', () => {
    const violations = verifyAssertionQuality(
      "it('always passes', () => { expect(true).toBe(true); });",
      'trivial.test.ts',
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ type: 'trivial-assertion' }),
    );
  });

  test('does not flag meaningful assertion', () => {
    const violations = verifyAssertionQuality(
      "it('adds', () => { expect(add(1, 2)).toBe(3); });",
      'ok.test.ts',
    );
    expect(violations).not.toContainEqual(
      expect.objectContaining({ type: 'trivial-assertion' }),
    );
  });

  test('detects missing edge case coverage', () => {
    const violations = verifyAssertionQuality(
      "it('happy path only', () => { expect(add(1, 2)).toBe(3); });",
      'happy.test.ts',
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ type: 'missing-edge-case' }),
    );
  });

  test('flags unconfigured mock', () => {
    const violations = verifyAssertionQuality(
      "it('mocks', () => { const fn = vi.fn(); fn(); expect(fn).toHaveBeenCalled(); });",
      'mock.test.ts',
    );
    expect(violations).toContainEqual(
      expect.objectContaining({ type: 'flaky-mock' }),
    );
  });

  test('does not flag configured mock', () => {
    const violations = verifyAssertionQuality(
      "it('mocks', () => { const fn = vi.fn(() => 42); expect(fn()).toBe(42); });",
      'mock.test.ts',
    );
    expect(violations).not.toContainEqual(
      expect.objectContaining({ type: 'flaky-mock' }),
    );
  });
});

describe('store', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test('locks, verifies clean, then detects drift', () => {
    dir = mkdtempSync(join(tmpdir(), 'test-lock-'));
    const file = join(dir, 'math.test.ts');
    const store = join(dir, 'store.json');
    writeFileSync(file, BASE_SOURCE);

    const locked = lockTestFile(file, store);
    expect(locked.hash).toHaveLength(64);
    expect(JSON.parse(readFileSync(store, 'utf8'))[file]).toBeDefined();

    expect(verifyTestFile(file, store)).toEqual([]);

    writeFileSync(file, BASE_SOURCE.replace("it('adds numbers'", "it.skip('adds numbers'"));
    const violations = verifyTestFile(file, store);

    expect(violations).toContainEqual(
      expect.objectContaining({ type: 'test-skipped', testName: 'adds numbers' }),
    );
  });

  test('unlocked file verifies clean', () => {
    dir = mkdtempSync(join(tmpdir(), 'test-lock-'));
    const file = join(dir, 'other.test.ts');
    const store = join(dir, 'store.json');
    writeFileSync(file, BASE_SOURCE);

    expect(verifyTestFile(file, store)).toEqual([]);
  });
});

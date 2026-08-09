import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, afterEach } from 'vitest';
import { CircuitBreaker } from './breaker';
import { CircuitBreakerTrippedError } from './error';
import { countChangedLines } from './diff';
import { saveState, loadState } from './persist';

describe('recordAttempt', () => {
  test('two identical attempts do not trip', () => {
    const breaker = new CircuitBreaker();
    breaker.recordAttempt('hash-a');
    const info = breaker.recordAttempt('hash-a');
    expect(info.tripped).toBe(false);
    expect(breaker.getState()).toBe('closed');
  });

  test('three identical consecutive attempts trip', () => {
    const breaker = new CircuitBreaker();
    breaker.recordAttempt('hash-a');
    breaker.recordAttempt('hash-a');
    const info = breaker.recordAttempt('hash-a');
    expect(info.tripped).toBe(true);
    expect(info.reason).toContain('repeated identical attempt');
    expect(breaker.getState()).toBe('open');
  });

  test('alternating pattern A-B-A does not trip', () => {
    const breaker = new CircuitBreaker();
    breaker.recordAttempt('hash-a');
    breaker.recordAttempt('hash-b');
    const info = breaker.recordAttempt('hash-a');
    expect(info.tripped).toBe(false);
    expect(breaker.getState()).toBe('closed');
  });

  test('respects custom maxRepeatedAttempts', () => {
    const breaker = new CircuitBreaker({ maxRepeatedAttempts: 2 });
    breaker.recordAttempt('hash-a');
    const info = breaker.recordAttempt('hash-a');
    expect(info.tripped).toBe(true);
  });
});

describe('recordToolCall', () => {
  test('trips when budget exceeded', () => {
    const breaker = new CircuitBreaker({ maxToolCalls: 3 });
    breaker.recordToolCall(1);
    breaker.recordToolCall(2);
    breaker.recordToolCall(3);
    const info = breaker.recordToolCall(4);
    expect(info.tripped).toBe(true);
    expect(info.reason).toContain('tool call budget exceeded');
    expect(info.reason).toContain('4/3');
    expect(breaker.getState()).toBe('open');
  });

  test('at budget limit does not trip', () => {
    const breaker = new CircuitBreaker({ maxToolCalls: 2 });
    breaker.recordToolCall(1);
    const info = breaker.recordToolCall(2);
    expect(info.tripped).toBe(false);
  });

  test('windowMs expires old entries', () => {
    const breaker = new CircuitBreaker({ maxToolCalls: 2, windowMs: 1000 });
    breaker.recordToolCall(1000);
    breaker.recordToolCall(1100);
    const info = breaker.recordToolCall(5000);
    expect(info.tripped).toBe(false);
    expect(breaker.getState()).toBe('closed');
  });

  test('windowMs counts calls inside window', () => {
    const breaker = new CircuitBreaker({ maxToolCalls: 2, windowMs: 1000 });
    breaker.recordToolCall(1000);
    breaker.recordToolCall(1500);
    const info = breaker.recordToolCall(1900);
    expect(info.tripped).toBe(true);
  });
});

describe('checkDiffLines', () => {
  test('under budget does not trip', () => {
    const breaker = new CircuitBreaker({ maxDiffLines: 100 });
    const info = breaker.checkDiffLines(50);
    expect(info.tripped).toBe(false);
    expect(breaker.getState()).toBe('closed');
  });

  test('over budget trips', () => {
    const breaker = new CircuitBreaker({ maxDiffLines: 100 });
    const info = breaker.checkDiffLines(101);
    expect(info.tripped).toBe(true);
    expect(info.reason).toContain('diff line budget exceeded');
    expect(breaker.getState()).toBe('open');
  });
});

describe('countChangedLines', () => {
  test('identical content has zero changes', () => {
    expect(countChangedLines('a\nb\nc', 'a\nb\nc')).toBe(0);
  });

  test('counts added lines', () => {
    expect(countChangedLines('a\nb', 'a\nb\nc\nd')).toBe(2);
  });

  test('counts removed lines', () => {
    expect(countChangedLines('a\nb\nc\nd', 'a\nd')).toBe(2);
  });

  test('counts modified lines as remove plus add', () => {
    expect(countChangedLines('a\nb\nc', 'a\nx\nc')).toBe(2);
  });

  test('empty before counts every line as added', () => {
    expect(countChangedLines('', 'a\nb\nc')).toBe(3);
  });
});

describe('persistence', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  test('save then load restores options, counters, and state', () => {
    dir = mkdtempSync(join(tmpdir(), 'circuit-breaker-'));
    const file = join(dir, 'state.json');

    const breaker = new CircuitBreaker({ maxToolCalls: 5 });
    breaker.recordAttempt('hash-a');
    breaker.recordAttempt('hash-a');
    breaker.recordAttempt('hash-a');
    saveState(file, breaker);

    const loaded = loadState(file);
    expect(loaded.getState()).toBe('open');
    expect(() => loaded.assertClosed()).toThrow(CircuitBreakerTrippedError);
  });

  test('loaded breaker keeps tool call budget from saved options', () => {
    dir = mkdtempSync(join(tmpdir(), 'circuit-breaker-'));
    const file = join(dir, 'state.json');

    const breaker = new CircuitBreaker({ maxToolCalls: 1 });
    breaker.recordToolCall(1000);
    saveState(file, breaker);

    const loaded = loadState(file);
    expect(loaded.recordToolCall(1001).tripped).toBe(true);
  });

  test('loaded breaker keeps consecutive attempt streak', () => {
    dir = mkdtempSync(join(tmpdir(), 'circuit-breaker-'));
    const file = join(dir, 'state.json');

    const breaker = new CircuitBreaker();
    breaker.recordAttempt('hash-a');
    breaker.recordAttempt('hash-a');
    saveState(file, breaker);

    const loaded = loadState(file);
    expect(loaded.recordAttempt('hash-a').tripped).toBe(true);
  });
});

describe('assertClosed and reset', () => {
  test('assertClosed throws CircuitBreakerTrippedError when open', () => {
    const breaker = new CircuitBreaker({ maxRepeatedAttempts: 1 });
    breaker.recordAttempt('hash-a');
    expect(() => breaker.assertClosed()).toThrow(CircuitBreakerTrippedError);
    try {
      breaker.assertClosed();
    } catch (error) {
      expect((error as CircuitBreakerTrippedError).reason).toContain('repeated identical attempt');
    }
  });

  test('assertClosed does not throw when closed', () => {
    const breaker = new CircuitBreaker();
    expect(() => breaker.assertClosed()).not.toThrow();
  });

  test('reset closes the breaker and clears counters', () => {
    const breaker = new CircuitBreaker();
    breaker.recordAttempt('hash-a');
    breaker.recordAttempt('hash-a');
    breaker.recordAttempt('hash-a');
    expect(breaker.getState()).toBe('open');

    breaker.reset();
    expect(breaker.getState()).toBe('closed');
    expect(breaker.recordAttempt('hash-a').tripped).toBe(false);
  });
});

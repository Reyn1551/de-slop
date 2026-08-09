import { CircuitBreakerTrippedError } from './error';
import type { BreakerOptions, BreakerState, TripInfo } from './types';

export const DEFAULT_MAX_REPEATED_ATTEMPTS = 3;
export const DEFAULT_MAX_TOOL_CALLS = 50;
export const DEFAULT_MAX_DIFF_LINES = 500;
export const DEFAULT_WINDOW_MS = 0;

export interface BreakerSnapshot {
  options: Required<BreakerOptions>;
  state: BreakerState;
  lastAttemptHash: string | null;
  consecutiveAttempts: number;
  toolCallTimestamps: number[];
  tripReason: string | null;
}

export class CircuitBreaker {
  private readonly options: Required<BreakerOptions>;
  private state: BreakerState = 'closed';
  private lastAttemptHash: string | null = null;
  private consecutiveAttempts = 0;
  private toolCallTimestamps: number[] = [];
  private tripReason: string | null = null;

  constructor(options: BreakerOptions = {}) {
    this.options = {
      maxRepeatedAttempts: options.maxRepeatedAttempts ?? DEFAULT_MAX_REPEATED_ATTEMPTS,
      maxToolCalls: options.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS,
      maxDiffLines: options.maxDiffLines ?? DEFAULT_MAX_DIFF_LINES,
      windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
    };
  }

  recordAttempt(attemptHash: string): TripInfo {
    if (attemptHash === this.lastAttemptHash) {
      this.consecutiveAttempts++;
    } else {
      this.lastAttemptHash = attemptHash;
      this.consecutiveAttempts = 1;
    }

    if (this.consecutiveAttempts >= this.options.maxRepeatedAttempts) {
      return this.trip(`repeated identical attempt ${this.consecutiveAttempts}x`);
    }
    return this.report(false);
  }

  recordToolCall(at: number = Date.now()): TripInfo {
    if (this.options.windowMs > 0) {
      const cutoff = at - this.options.windowMs;
      this.toolCallTimestamps = this.toolCallTimestamps.filter((t) => t >= cutoff);
    }
    this.toolCallTimestamps.push(at);

    if (this.toolCallTimestamps.length > this.options.maxToolCalls) {
      return this.trip(
        `tool call budget exceeded (${this.toolCallTimestamps.length}/${this.options.maxToolCalls})`,
      );
    }
    return this.report(false);
  }

  checkDiffLines(changedLines: number): TripInfo {
    if (changedLines > this.options.maxDiffLines) {
      return this.trip(
        `diff line budget exceeded (${changedLines}/${this.options.maxDiffLines})`,
      );
    }
    return this.report(false);
  }

  getState(): BreakerState {
    return this.state;
  }

  getTripReason(): string | null {
    return this.tripReason;
  }

  assertClosed(): void {
    if (this.state === 'open') {
      throw new CircuitBreakerTrippedError(this.tripReason ?? 'circuit breaker is open');
    }
  }

  reset(): void {
    this.state = 'closed';
    this.lastAttemptHash = null;
    this.consecutiveAttempts = 0;
    this.toolCallTimestamps = [];
    this.tripReason = null;
  }

  toSnapshot(): BreakerSnapshot {
    return {
      options: { ...this.options },
      state: this.state,
      lastAttemptHash: this.lastAttemptHash,
      consecutiveAttempts: this.consecutiveAttempts,
      toolCallTimestamps: [...this.toolCallTimestamps],
      tripReason: this.tripReason,
    };
  }

  static fromSnapshot(snapshot: BreakerSnapshot): CircuitBreaker {
    const breaker = new CircuitBreaker(snapshot.options);
    breaker.state = snapshot.state;
    breaker.lastAttemptHash = snapshot.lastAttemptHash;
    breaker.consecutiveAttempts = snapshot.consecutiveAttempts;
    breaker.toolCallTimestamps = [...snapshot.toolCallTimestamps];
    breaker.tripReason = snapshot.tripReason;
    return breaker;
  }

  private trip(reason: string): TripInfo {
    this.state = 'open';
    this.tripReason = reason;
    return this.report(true, reason);
  }

  private report(tripped: boolean, reason?: string): TripInfo {
    return { tripped, reason, state: this.state };
  }
}

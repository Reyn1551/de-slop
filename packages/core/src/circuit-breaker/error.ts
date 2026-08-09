export class CircuitBreakerTrippedError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'CircuitBreakerTrippedError';
    this.reason = reason;
  }
}

export type { BreakerOptions, BreakerState, TripInfo } from './types';
export { CircuitBreakerTrippedError } from './error';
export {
  CircuitBreaker,
  type BreakerSnapshot,
  DEFAULT_MAX_DIFF_LINES,
  DEFAULT_MAX_REPEATED_ATTEMPTS,
  DEFAULT_MAX_TOOL_CALLS,
  DEFAULT_WINDOW_MS,
} from './breaker';
export { countChangedLines } from './diff';
export { loadState, saveState } from './persist';

export type BreakerState = 'closed' | 'open' | 'half-open';

export interface BreakerOptions {
  maxRepeatedAttempts?: number;
  maxToolCalls?: number;
  maxDiffLines?: number;
  windowMs?: number;
}

export interface TripInfo {
  tripped: boolean;
  reason?: string;
  state: BreakerState;
}

import { readFileSync, writeFileSync } from 'node:fs';
import { CircuitBreaker, type BreakerSnapshot } from './breaker';

export function saveState(path: string, breaker: CircuitBreaker): void {
  writeFileSync(path, JSON.stringify(breaker.toSnapshot(), null, 2), 'utf8');
}

export function loadState(path: string): CircuitBreaker {
  const raw = readFileSync(path, 'utf8');
  return CircuitBreaker.fromSnapshot(JSON.parse(raw) as BreakerSnapshot);
}

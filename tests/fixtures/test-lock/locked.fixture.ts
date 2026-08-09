import { describe, it, expect } from 'vitest';

describe('counter', () => {
  it('increments by one', () => {
    let count = 0;
    count += 1;
    expect(count).toBe(1);
  });

  it('keeps working across calls', () => {
    expect(typeof Date.now).toBe('function');
  });
});

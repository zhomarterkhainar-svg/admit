import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from './oneEuro';

describe('OneEuroFilter', () => {
  it('passes the first sample through', () => {
    expect(new OneEuroFilter().filter(5, 0)).toBe(5);
  });

  it('reduces jitter on a noisy constant signal', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
    let maxDev = 0;
    for (let i = 0; i < 300; i++) {
      const noisy = 1 + (i % 2 === 0 ? 0.05 : -0.05);
      const y = f.filter(noisy, i * 33);
      if (i > 30) maxDev = Math.max(maxDev, Math.abs(y - 1));
    }
    expect(maxDev).toBeLessThan(0.03);
  });

  it('tracks a step change', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0.5 });
    let y = 0;
    for (let i = 0; i < 60; i++) y = f.filter(i < 10 ? 0 : 1, i * 33);
    expect(y).toBeGreaterThan(0.95);
  });
});

import { describe, expect, it } from 'vitest';
import { dtw, resample, smoothnessScore } from './dtw';

const series = (n: number, f: (x: number) => number, dt = 33) =>
  Array.from({ length: n }, (_, i) => ({ t: i * dt, v: f(i / (n - 1)) }));

describe('dtw', () => {
  it('is 0 for identical sequences and tolerates time warping', () => {
    const a = [0, 0.5, 1, 0.5, 0];
    expect(dtw(a, a)).toBe(0);
    expect(dtw(a, [0, 0, 0.5, 1, 1, 0.5, 0])).toBe(0);
    expect(dtw(a, [1, 1, 1, 1, 1])).toBeGreaterThan(0.3);
  });

  it('resamples irregular samples', () => {
    expect(
      resample(
        [
          { t: 0, v: 0 },
          { t: 10, v: 1 },
        ],
        3,
      ),
    ).toEqual([0, 0.5, 1]);
  });
});

describe('smoothnessScore', () => {
  it('a smooth down-up rep scores high, regardless of speed', () => {
    expect(smoothnessScore(series(60, (x) => Math.sin(Math.PI * x)))).toBeGreaterThanOrEqual(85);
    expect(smoothnessScore(series(25, (x) => Math.sin(Math.PI * x)))).toBeGreaterThanOrEqual(85);
  });

  it('a bouncy rep (double dip) scores clearly lower', () => {
    const smooth = smoothnessScore(series(60, (x) => Math.sin(Math.PI * x)))!;
    const bouncy = smoothnessScore(series(60, (x) => Math.abs(Math.sin(2 * Math.PI * x))))!;
    expect(smooth - bouncy).toBeGreaterThanOrEqual(15);
  });

  it('a jerky rep scores lower', () => {
    const smooth = smoothnessScore(series(60, (x) => Math.sin(Math.PI * x)))!;
    const jerky = smoothnessScore(
      series(60, (x) => Math.sin(Math.PI * x) + (Math.floor(x * 30) % 2 ? 0.12 : -0.12)),
    )!;
    expect(smooth - jerky).toBeGreaterThanOrEqual(15);
  });

  it('skips reps with too few samples or no movement', () => {
    expect(smoothnessScore(series(4, (x) => x))).toBeUndefined();
    expect(smoothnessScore(series(30, () => 0.5))).toBeUndefined();
  });
});

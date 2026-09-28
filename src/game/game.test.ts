import { describe, expect, it } from 'vitest';
import type { RepSummary } from '@/engine/types';
import { rankFor } from './ranks';
import { summarize } from './summary';

const rep = (counted: boolean, quality: number, errors: string[] = []): RepSummary => ({
  index: 0,
  startT: 0,
  endT: 1,
  counted,
  quality,
  errors,
});

describe('summarize', () => {
  it('aggregates reps, clean %, quality, top errors and xp', () => {
    const s = summarize(
      'quick',
      [
        {
          id: 'squat',
          target: 3,
          durationMs: 30000,
          reps: [rep(true, 100), rep(true, 80, ['squat.torso']), rep(false, 0, ['squat.depth'])],
        },
        {
          id: 'press',
          target: 1,
          durationMs: 30000,
          reps: [rep(true, 70, ['press.asym', 'squat.torso'])],
        },
      ],
      0,
      60000,
    );
    expect(s.counted).toBe(3);
    expect(s.attempted).toBe(4);
    expect(s.cleanPct).toBe(25);
    expect(s.quality).toBe(83);
    expect(s.topErrors[0]).toEqual({ id: 'squat.torso', count: 2 });
    expect(s.xp).toBeGreaterThan(0);
    expect(s.kcal).toBe(6);
  });

  it('handles an empty workout', () => {
    const s = summarize('quick', [], 0, 0);
    expect(s.quality).toBe(0);
    expect(s.cleanPct).toBe(0);
  });
});

describe('ranks', () => {
  it('progresses through ranks', () => {
    expect(rankFor(0).rank.key).toBe('rank.zhas');
    expect(rankFor(149).rank.key).toBe('rank.zhas');
    expect(rankFor(150).rank.key).toBe('rank.batyr');
    expect(rankFor(5000).rank.key).toBe('rank.alyp');
    expect(rankFor(5000).next).toBeNull();
    expect(rankFor(325).progress).toBeCloseTo(0.5);
  });
});

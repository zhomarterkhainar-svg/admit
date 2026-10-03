import { describe, expect, it } from 'vitest';
import { blend, repSequence, squatDown } from '../../tests/helpers/pose';
import { runExercise } from '../../tests/helpers/run';
import { squat } from '@/exercises/squat';
import type { RepSummary } from '@/engine/types';
import type { HistoryEntry } from '@/storage/progress';
import { moveStats, movementProfile, tempoOf, type MoveStats } from './movementProfile';
import { summarize } from './summary';

const rep = (depth: number, ms: number, extra: Partial<RepSummary> = {}): RepSummary => ({
  index: 0,
  startT: 0,
  endT: ms,
  counted: true,
  quality: 100,
  errors: [],
  depth,
  rom: depth,
  ...extra,
});

const session = (
  moves: Record<string, MoveStats>,
  errorRates: Record<string, number> = {},
): HistoryEntry => ({
  at: 0,
  programId: 'p',
  counted: 1,
  attempted: 1,
  quality: 100,
  cleanPct: 100,
  xp: 0,
  durationMs: 0,
  tried: Object.fromEntries(Object.entries(moves).map(([id, m]) => [id, m.reps])),
  errorRates,
  moves,
});

const stats = (depth: number, extra: Partial<MoveStats> = {}): MoveStats => ({
  reps: 5,
  depth,
  depthSd: 0.05,
  rom: depth,
  repMs: 2000,
  ...extra,
});

describe('movement profile', () => {
  it('every squat rep carries its depth, range of motion and knee angle', () => {
    const { reps } = runExercise(squat, repSequence(squatDown(), { reps: 2 }));
    expect(reps).toHaveLength(2);
    for (const r of reps) {
      expect(r.depth).toBeGreaterThan(0.8);
      expect(r.rom).toBeGreaterThan(0.6);
      expect(r.angle).toBeGreaterThan(60);
      expect(r.angle).toBeLessThan(110);
    }
  });

  it('a shallow squat reads shallower, with a wider knee angle', () => {
    const deep = runExercise(squat, repSequence(squatDown(), { reps: 1 })).reps[0]!;
    const shallow = runExercise(squat, repSequence(blend({}, squatDown(), 0.6), { reps: 1 }))
      .reps[0]!;
    expect(shallow.depth!).toBeLessThan(deep.depth!);
    expect(shallow.angle!).toBeGreaterThan(deep.angle!);
  });

  it('a session is summarised per exercise: mean depth, spread, tempo', () => {
    const s = summarize(
      'p',
      [
        {
          id: 'squat',
          target: 3,
          durationMs: 6000,
          reps: [rep(0.8, 2000, { angle: 95, smoothness: 80 }), rep(1, 2000, { angle: 85 })],
        },
      ],
      0,
      6000,
    );
    const m = moveStats(s).squat!;
    expect(m).toMatchObject({ reps: 2, depth: 0.9, depthSd: 0.1, repMs: 2000, angle: 90 });
    expect(m.smooth).toBe(80);
  });

  it('a plank (held seconds) has no movement stats', () => {
    const s = summarize(
      'p',
      [{ id: 'plank', target: 10, durationMs: 5000, reps: [rep(1, 1000)] }],
      0,
      5000,
    );
    expect(moveStats(s)).toEqual({});
  });

  it('builds up over sessions: averages, trend, stability, tempo and typical errors', () => {
    const history = [
      session({ squat: stats(0.7) }, { 'squat.valgus': 0.4, 'squat.torso': 0.05 }),
      session({ squat: stats(0.7) }, { 'squat.valgus': 0.2 }),
      session({ squat: stats(0.9, { smooth: 90 }) }, {}),
    ];
    const [p] = movementProfile(history);
    expect(p).toMatchObject({ id: 'squat', sessions: 3, reps: 15, depthPct: 77, repSec: 2 });
    expect(p!.depthTrend).toBe(20); // 90% now vs 70% before
    expect(p!.tempo).toBe('steady');
    // the most common error first; a rare one (< 10% of reps) is not "typical"
    expect(p!.errors).toEqual([{ id: 'squat.valgus', rate: 0.2 }]);
  });

  it('stability drops when the reps are all different', () => {
    const steady = movementProfile([session({ squat: stats(0.8, { depthSd: 0.02 }) })])[0]!;
    const shaky = movementProfile([session({ squat: stats(0.8, { depthSd: 0.2 }) })])[0]!;
    expect(steady.stability).toBeGreaterThan(85);
    expect(shaky.stability).toBeLessThan(30);
    expect(steady.depthTrend).toBeNull(); // one session: no trend yet
  });

  it('most practised exercise first; old saves without movement data are fine', () => {
    const old: HistoryEntry = { ...session({}), moves: undefined };
    const list = movementProfile([
      old,
      session({ squat: stats(0.8), lunge: stats(0.8, { reps: 12 }) }),
    ]);
    expect(list.map((p) => p.id)).toEqual(['lunge', 'squat']);
  });

  it('tempo bands', () => {
    expect(tempoOf(0.9)).toBe('fast');
    expect(tempoOf(2)).toBe('steady');
    expect(tempoOf(4)).toBe('slow');
    // a jumping jack is quick by nature: 0.7 s is a normal pace for it, not rushed
    expect(tempoOf(0.7, 'jumpingJack')).toBe('steady');
    expect(tempoOf(0.7, 'squat')).toBe('fast');
  });
});

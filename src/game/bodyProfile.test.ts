import { describe, expect, it } from 'vitest';
import { repSequence, squatDown } from '../../tests/helpers/pose';
import { runExercise } from '../../tests/helpers/run';
import { squat } from '@/exercises/squat';
import type { RepSummary } from '@/engine/types';
import type { AnyExerciseId } from '@/exercises/registry';
import type { HistoryEntry } from '@/storage/progress';
import {
  asymScore,
  bodyProfile,
  bodyStats,
  profileUpdate,
  shoulderScore,
  typicalErrors,
  type BodyStats,
} from './bodyProfile';
import { summarize } from './summary';

let clock = 0;
const rep = (p: Partial<RepSummary> = {}): RepSummary => {
  clock += 2000;
  return {
    index: 0,
    startT: clock - 2000,
    endT: clock,
    counted: true,
    quality: 100,
    errors: [],
    depth: 0.9,
    rom: 0.9,
    ...p,
  };
};
const workout = (results: [AnyExerciseId, RepSummary[]][]) =>
  bodyStats(
    summarize(
      'p',
      results.map(([id, reps]) => ({ id, target: 0, durationMs: 1000, reps })),
      0,
      60_000,
    ),
  );
const entry = (body: BodyStats, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  at: 0,
  programId: 'p',
  counted: 1,
  attempted: 1,
  quality: 100,
  cleanPct: 100,
  xp: 0,
  durationMs: 0,
  body,
  ...extra,
});

describe('QOZĞAL Movement Profile', () => {
  it('the engine measures left/right symmetry and torso wobble of every squat', () => {
    const { reps } = runExercise(squat, repSequence(squatDown(), { reps: 2 }));
    for (const r of reps) {
      expect(r.asym).toBeLessThan(3); // the reference squat is symmetric
      expect(r.sway).toBeLessThan(2);
    }
    const lopsided = runExercise(
      squat,
      repSequence(squatDown(), { reps: 1 }).map((f) => {
        // the right knee bends less than the left
        const knee = f.image[26]!;
        return {
          ...f,
          image: f.image.map((p, i) => (i === 26 ? { ...knee, y: knee.y + 0.02 } : p)),
        };
      }),
    ).reps[0];
    expect(lopsided?.asym ?? 0).toBeGreaterThanOrEqual(reps[0]!.asym!);
  });

  it('scores: shoulder angle, asymmetry', () => {
    expect(shoulderScore(175)).toBe(100);
    expect(shoulderScore(110)).toBe(0);
    expect(asymScore(0)).toBe(100);
    expect(asymScore(10)).toBe(60);
  });

  it('one workout → all eight qualities', () => {
    const b = workout([
      [
        'squat',
        [
          rep({ asym: 2, sway: 1, smoothness: 80 }),
          rep({ asym: 4, sway: 1, errors: ['squat.valgus'] }),
        ],
      ],
      ['jumpingJack', [rep({ shoulder: 160, asym: 3, sway: 2 })]],
      ['lunge', [rep({ side: 'l', depth: 0.9 }), rep({ side: 'r', depth: 0.8 })]],
    ]);
    expect(b.shoulders).toBe(Math.round(shoulderScore(160)));
    expect(b.knees).toBe(75); // 1 of 4 squat/lunge reps with the knees caving in
    // angle symmetry (asym 2,4,3 → 88) and lunge sides (0.9 vs 0.8 → 80), averaged
    expect(b.symmetry).toBe(84);
    expect(b.amplitude).toBe(90);
    expect(b.speed).toBe(30); // 2 s per rep
    expect(b.smoothness).toBe(80);
    expect(b.squatDepth).toBe(90);
    expect(b.core).toBeGreaterThan(80);
  });

  it('core stability drops with sagging / leaning errors', () => {
    const good = workout([['squat', [rep({ sway: 1 }), rep({ sway: 1 })]]]);
    const bad = workout([
      [
        'squat',
        [rep({ sway: 1, errors: ['squat.torso'] }), rep({ sway: 1, errors: ['squat.torso'] })],
      ],
    ]);
    expect(bad.core!).toBeLessThan(good.core! - 40);
  });

  it('nothing measured → the quality is simply absent', () => {
    const b = workout([['plank', [rep({ depth: undefined, rom: undefined })]]]);
    expect(b.shoulders).toBeUndefined();
    expect(b.knees).toBeUndefined();
    expect(b.symmetry).toBeUndefined();
  });

  it('profile = averages of the last sessions; old saves without data are skipped', () => {
    const p = bodyProfile([
      entry({}, { body: undefined }),
      entry({ symmetry: 70 }),
      entry({ symmetry: 80, speed: 20 }),
    ]);
    expect(p).toEqual({ symmetry: 75, speed: 20 });
  });

  it('"profile updated": the latest workout vs the earlier ones, biggest changes first', () => {
    const history = [
      entry({ symmetry: 70, core: 60, squatDepth: 80, speed: 20, knees: 90 }),
      entry({ symmetry: 72, core: 64, squatDepth: 82, speed: 20, knees: 90 }),
      entry({ symmetry: 79, core: 74, squatDepth: 87, speed: 22, knees: 90 }),
    ];
    expect(profileUpdate(history)).toEqual([
      { key: 'core', delta: 12 },
      { key: 'speed', delta: 10 }, // relative: 22 vs 20 reps/min
      { key: 'symmetry', delta: 8 },
    ]);
  });

  it('first workout: the profile is created (nothing to compare with)', () => {
    expect(profileUpdate([entry({ symmetry: 70 })])).toBeNull();
    expect(profileUpdate([entry({ symmetry: 70 }), entry({ symmetry: 70 })])).toEqual([]);
  });

  it('typical errors over the recent sessions with that exercise', () => {
    const h = [
      entry({}, { tried: { squat: 10 }, errorRates: { 'squat.valgus': 0.4, 'squat.torso': 0.05 } }),
      entry({}, { tried: { squat: 10 }, errorRates: { 'squat.valgus': 0.2 } }),
      entry({}, { tried: { lunge: 10 }, errorRates: {} }), // no squats: does not dilute
    ];
    expect(typicalErrors(h)).toEqual([{ id: 'squat.valgus', rate: 0.3 }]);
  });
});

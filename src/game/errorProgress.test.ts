import { describe, expect, it } from 'vitest';
import type { RepSummary } from '@/engine/types';
import type { AnyExerciseId } from '@/exercises/registry';
import { errorStats, type HistoryEntry } from '@/storage/progress';
import { summarize } from './summary';
import { errorJourney, errorProgress } from './errorProgress';

const rep = (errors: string[] = [], counted = true): RepSummary => ({
  index: 0,
  startT: 0,
  endT: 1,
  counted,
  quality: 100,
  errors,
});

/** A session of `n` reps of one exercise, the first `bad` of them with `error`. */
function session(id: AnyExerciseId, n: number, bad: number, error: string): HistoryEntry {
  const reps = Array.from({ length: n }, (_, i) => rep(i < bad ? [error] : []));
  const s = summarize('single', [{ id, target: n, reps, durationMs: 1000 }], 0, 1000);
  return {
    at: 0,
    programId: 'single',
    counted: n,
    attempted: n,
    quality: 100,
    cleanPct: 0,
    xp: 0,
    durationMs: 0,
    ...errorStats(s),
  };
}

describe('error stats of a session', () => {
  it('share of the exercise reps with each error; setup and wrong-exercise are skipped', () => {
    const s = summarize(
      'quick',
      [
        {
          id: 'squat',
          target: 4,
          reps: [
            rep(['squat.valgus']),
            rep(['squat.valgus', 'squat.depth'], false),
            rep(['setup.tooFar']),
            rep(['wrongExercise']),
          ],
          durationMs: 1,
        },
        { id: 'press', target: 2, reps: [rep(), rep(['press.asym'])], durationMs: 1 },
      ],
      0,
      1,
    );
    const { tried, errorRates } = errorStats(s);
    expect(tried).toEqual({ squat: 4, press: 2 });
    expect(errorRates).toEqual({ 'squat.valgus': 0.5, 'squat.depth': 0.25, 'press.asym': 0.5 });
  });
});

describe('error progress', () => {
  it('compares the last session with the average of the earlier ones', () => {
    const history = [
      session('squat', 10, 4, 'squat.valgus'),
      session('squat', 10, 4, 'squat.valgus'),
      session('squat', 10, 1, 'squat.valgus'),
    ];
    const [valgus] = errorProgress(history);
    expect(valgus).toMatchObject({ id: 'squat.valgus' });
    expect(valgus!.before).toBeCloseTo(0.4);
    expect(valgus!.now).toBeCloseTo(0.1);
  });

  it('a session with the exercise but without the error counts as 0', () => {
    const history = [
      session('squat', 10, 6, 'squat.valgus'),
      session('squat', 10, 0, 'squat.valgus'),
      session('squat', 10, 3, 'squat.valgus'),
    ];
    expect(errorProgress(history)[0]!.before).toBeCloseTo(0.3);
  });

  it('sessions without that exercise are ignored; the window is the last 5', () => {
    const history = [
      session('squat', 10, 10, 'squat.valgus'), // outside the window
      ...Array.from({ length: 5 }, () => session('squat', 10, 2, 'squat.valgus')),
      session('press', 10, 5, 'press.asym'), // no squats: not part of the squat average
      session('squat', 10, 0, 'squat.valgus'),
    ];
    const valgus = errorProgress(history).find((e) => e.id === 'squat.valgus')!;
    expect(valgus.before).toBeCloseTo(0.2);
    expect(valgus.now).toBe(0);
    const asym = errorProgress(history).find((e) => e.id === 'press.asym')!;
    expect(asym.now).toBeNull(); // no press in the last session
  });

  it('the first time an error shows up there is nothing to compare with', () => {
    const [e] = errorProgress([session('squat', 10, 3, 'squat.valgus')]);
    expect(e).toEqual({ id: 'squat.valgus', now: 0.3, before: null });
  });

  it('sorted by how common the error used to be', () => {
    const a = session('squat', 10, 2, 'squat.valgus');
    const b = session('squat', 10, 5, 'squat.depth');
    const history = [
      { ...a, errorRates: { ...a.errorRates, ...b.errorRates } },
      session('squat', 10, 0, 'squat.valgus'),
    ];
    expect(errorProgress(history).map((e) => e.id)).toEqual(['squat.depth', 'squat.valgus']);
  });
});

describe('error journey (profile)', () => {
  it('first sessions vs the latest ones, most frequent errors first', () => {
    const history = [
      session('squat', 10, 6, 'squat.valgus'),
      session('squat', 10, 4, 'squat.valgus'),
      session('squat', 10, 5, 'squat.valgus'),
      session('squat', 10, 1, 'squat.valgus'),
      session('squat', 10, 1, 'squat.valgus'),
      session('squat', 10, 1, 'squat.valgus'),
      session('press', 10, 1, 'press.asym'),
      session('press', 10, 0, 'press.asym'),
    ];
    const j = errorJourney(history);
    expect(j.map((e) => e.id)).toEqual(['squat.valgus', 'press.asym']);
    expect(j[0]!.first).toBeCloseTo(0.5);
    expect(j[0]!.last).toBeCloseTo(0.1);
    expect(j[1]).toMatchObject({ first: 0.1, last: 0 });
  });

  it('needs at least two sessions with the exercise', () => {
    expect(errorJourney([session('squat', 10, 5, 'squat.valgus')])).toEqual([]);
  });
});

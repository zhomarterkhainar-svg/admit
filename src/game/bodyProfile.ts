import { ALL_EXERCISES, type AnyExerciseId } from '@/exercises/registry';
import type { RepSummary } from '@/engine/types';
import type { HistoryEntry } from '@/storage/progress';
import type { WorkoutSummary } from './summary';

/**
 * QOZĞAL Movement Profile: the whole body across all exercises, one number per quality.
 * Scores are 0..100 (higher = better); `speed` is reps per minute.
 */
export interface BodyStats {
  /** how high the arms go overhead (jumping jack, press) */
  shoulders?: number;
  /** knees track over the toes: share of squat / lunge reps without the knees caving in */
  knees?: number;
  /** left vs right: equal joint angles in two-sided moves, equal depth on both sides of lunges */
  symmetry?: number;
  /** average range of motion of the reps */
  amplitude?: number;
  /** torso / core: no sagging, arching or leaning errors and little sideways wobble */
  core?: number;
  /** reps per minute while moving */
  speed?: number;
  /** movement control: how smooth the reps are (DTW) */
  smoothness?: number;
  /** average squat depth (shown in the "profile updated" card) */
  squatDepth?: number;
}

export type BodyKey = keyof BodyStats;
/** the radar / list order; `squatDepth` is an extra, not a profile axis */
export const BODY_KEYS = [
  'shoulders',
  'knees',
  'symmetry',
  'amplitude',
  'core',
  'speed',
  'smoothness',
] as const satisfies readonly BodyKey[];

/** errors that mean the knees do not track over the toes */
const KNEE_ERRORS = new Set(['squat.valgus', 'lunge.kneeIn', 'sideBend.knees']);
/** errors of the torso / core */
const CORE_ERRORS = new Set([
  'squat.torso',
  'lunge.torso',
  'lunge.balance',
  'press.arch',
  'pushup.sag',
  'pushup.pike',
  'plank.sag',
  'plank.pike',
  'plank.broken',
  'sideBend.forward',
  'sideBend.hips',
]);
/** exercises that load the knees */
const KNEE_EXERCISES = new Set(['squat', 'lunge']);

const clamp = (v: number) => Math.min(100, Math.max(0, v));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const avg = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? mean(v) : undefined;
};
const r0 = (v: number | undefined) => (v === undefined ? undefined : Math.round(v));

/** Shoulder angle → mobility score: arms at shoulder height (≈110°) 0 … straight up (175°) 100. */
export const shoulderScore = (deg: number) => clamp(((deg - 110) / (175 - 110)) * 100);
/** Mean left/right difference (deg) → symmetry score: 4 points per degree. */
export const asymScore = (deg: number) => clamp(100 - 4 * deg);
/** Torso side-wobble (std of the lean, deg) → steadiness score. */
export const swayScore = (deg: number) => clamp(100 - 6 * deg);

/** The profile numbers of one finished workout. */
export function bodyStats(s: WorkoutSummary): BodyStats {
  const reps: { id: AnyExerciseId; rep: RepSummary }[] = s.results.flatMap((r) =>
    r.reps.map((rep) => ({ id: r.id, rep })),
  );
  const isHold = (id: AnyExerciseId) => !!ALL_EXERCISES[id]?.hold;
  const moving = reps.filter((x) => !isHold(x.id));

  const shoulders = avg(moving.map((x) => x.rep.shoulder).map((d) => d && shoulderScore(d)));

  const kneeReps = moving.filter((x) => KNEE_EXERCISES.has(x.id));
  const knees = kneeReps.length
    ? 100 *
      (1 -
        kneeReps.filter((x) => x.rep.errors.some((e) => KNEE_ERRORS.has(e))).length /
          kneeReps.length)
    : undefined;

  // symmetry: two-sided moves by their joint angles, one-sided moves by the depth on each side
  const angleSym = avg(
    moving.map((x) => x.rep.asym).map((d) => (d !== undefined ? asymScore(d) : undefined)),
  );
  const sideSym = avg(
    (['lunge', 'sideBend'] as const).map((id) => {
      const side = (sd: 'l' | 'r') =>
        avg(moving.filter((x) => x.id === id && x.rep.side === sd).map((x) => x.rep.depth));
      const l = side('l');
      const r = side('r');
      return l !== undefined && r !== undefined ? clamp(100 - 200 * Math.abs(l - r)) : undefined;
    }),
  );
  const symmetry = avg([angleSym, sideSym]);

  const amplitude = avg(moving.map((x) => x.rep.rom ?? x.rep.depth));

  const coreErrors = reps.length
    ? 100 *
      (1 - reps.filter((x) => x.rep.errors.some((e) => CORE_ERRORS.has(e))).length / reps.length)
    : undefined;
  // sideways wobble only means something standing up and when leaning is not the exercise
  const steady = avg(
    moving
      .filter((x) => x.id !== 'sideBend' && ALL_EXERCISES[x.id]?.posture !== 'floor')
      .map((x) => x.rep.sway)
      .map((d) => (d !== undefined ? swayScore(d) : undefined)),
  );
  const core = avg([coreErrors, steady]);

  const repMs = avg(moving.map((x) => x.rep.endT - x.rep.startT));
  const speed = repMs ? Math.round(600_000 / repMs) / 10 : undefined;

  const smoothness = avg(reps.map((x) => x.rep.smoothness));
  const squatDepth = avg(moving.filter((x) => x.id === 'squat').map((x) => x.rep.depth));

  const out: BodyStats = {
    shoulders: r0(shoulders),
    knees: r0(knees),
    symmetry: r0(symmetry),
    amplitude: r0(amplitude !== undefined ? 100 * amplitude : undefined),
    core: r0(core),
    speed,
    smoothness: r0(smoothness),
    squatDepth: r0(squatDepth !== undefined ? 100 * squatDepth : undefined),
  };
  for (const k of Object.keys(out) as BodyKey[]) if (out[k] === undefined) delete out[k];
  return out;
}

const keysOf = (b: BodyStats) => Object.keys(b) as BodyKey[];

/** Each quality averaged over the last `window` sessions that measured it. */
export function bodyProfile(history: readonly HistoryEntry[], window = 5): BodyStats {
  const out: BodyStats = {};
  const keys = new Set(history.flatMap((h) => (h.body ? keysOf(h.body) : [])));
  for (const k of keys) {
    const vals = history
      .map((h) => h.body?.[k])
      .filter((v): v is number => typeof v === 'number')
      .slice(-window);
    const v = mean(vals);
    out[k] = k === 'speed' ? Math.round(v * 10) / 10 : Math.round(v);
  }
  return out;
}

/** One line of "your movement profile is updated": Symmetry ↑ 8%. */
export interface BodyChange {
  key: BodyKey;
  /** percent: score points for the 0..100 qualities, relative change for the speed */
  delta: number;
}

/**
 * What the workout just finished changed in the profile: each quality measured now against its
 * average over the (up to 5) previous sessions. The biggest changes first, `limit` of them;
 * null when there is nothing to compare with yet (the profile has just been created).
 */
export function profileUpdate(history: readonly HistoryEntry[], limit = 3): BodyChange[] | null {
  const last = history.at(-1)?.body;
  if (!last) return null;
  const before = bodyProfile(history.slice(0, -1));
  const changes = keysOf(last)
    .filter((k) => before[k] !== undefined)
    .map((k) => {
      const now = last[k]!;
      const was = before[k]!;
      const delta = k === 'speed' ? (was > 0 ? (100 * (now - was)) / was : 0) : now - was;
      return { key: k, delta: Math.round(delta) };
    });
  if (!changes.length) return null;
  return changes
    .filter((c) => c.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}

/** The most frequent technique errors over the last `window` sessions (share of reps 0..1). */
export function typicalErrors(
  history: readonly HistoryEntry[],
  window = 5,
  limit = 3,
): { id: string; rate: number }[] {
  const recent = history.slice(-window);
  const ids = new Set(recent.flatMap((h) => Object.keys(h.errorRates ?? {})));
  return [...ids]
    .map((id) => {
      const ex = id.split('.')[0]!;
      const with_ = recent.filter((h) => (h.tried?.[ex] ?? 0) > 0);
      const rate = with_.length ? mean(with_.map((h) => h.errorRates?.[id] ?? 0)) : 0;
      return { id, rate: Math.round(rate * 100) / 100 };
    })
    .filter((e) => e.rate >= 0.1)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, limit);
}

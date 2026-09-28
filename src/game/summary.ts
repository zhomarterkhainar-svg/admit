import type { ExerciseId } from '@/exercises/registry';
import type { RepSummary } from '@/engine/types';

export interface ExerciseResult {
  id: ExerciseId;
  target: number;
  reps: RepSummary[];
  durationMs: number;
}

export interface ErrorStat {
  id: string;
  count: number;
}

export interface WorkoutSummary {
  programId: string;
  startedAt: number;
  durationMs: number;
  results: ExerciseResult[];
  counted: number;
  attempted: number;
  /** % of attempted reps that were counted AND had no errors */
  cleanPct: number;
  /** average quality of counted reps, 0..100 */
  quality: number;
  topErrors: ErrorStat[];
  xp: number;
  kcal: number;
  /** longest run of consecutive counted reps without any error */
  bestCleanStreak: number;
}

/** Bodyweight circuit ≈ 5 MET; 70 kg reference body. kcal/min = MET·3.5·kg/200 */
const KCAL_PER_MIN = (5 * 3.5 * 70) / 200;

export function summarize(
  programId: string,
  results: ExerciseResult[],
  startedAt: number,
  endedAt: number,
): WorkoutSummary {
  const reps = results.flatMap((r) => r.reps);
  const counted = reps.filter((r) => r.counted);
  const clean = counted.filter((r) => r.errors.length === 0);
  const errorCounts = new Map<string, number>();
  for (const r of reps) for (const e of r.errors) errorCounts.set(e, (errorCounts.get(e) ?? 0) + 1);
  const topErrors = [...errorCounts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const quality = counted.length
    ? Math.round(counted.reduce((s, r) => s + r.quality, 0) / counted.length)
    : 0;
  const durationMs = Math.max(0, endedAt - startedAt);
  const completedSteps = results.filter(
    (r) => r.reps.filter((x) => x.counted).length >= r.target,
  ).length;
  const xp = Math.round(
    counted.reduce((s, r) => s + 10 * (0.5 + r.quality / 200), 0) +
      clean.length * 5 +
      completedSteps * 20,
  );
  let run = 0;
  let bestCleanStreak = 0;
  for (const r of reps) {
    run = r.counted && r.errors.length === 0 ? run + 1 : 0;
    bestCleanStreak = Math.max(bestCleanStreak, run);
  }
  return {
    bestCleanStreak,
    programId,
    startedAt,
    durationMs,
    results,
    counted: counted.length,
    attempted: reps.length,
    cleanPct: reps.length ? Math.round((clean.length / reps.length) * 100) : 0,
    quality,
    topErrors,
    xp,
    kcal: Math.round((durationMs / 60000) * KCAL_PER_MIN),
  };
}

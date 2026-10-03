import { ALL_EXERCISES } from '@/exercises/registry';
import type { HistoryEntry } from '@/storage/progress';
import type { WorkoutSummary } from './summary';

/** One exercise in one session: averages over its reps (kept in the history entry). */
export interface MoveStats {
  /** reps with measurements */
  reps: number;
  /** mean deepest point, 0..1 of the exercise's full depth */
  depth: number;
  /** spread (standard deviation) of the depth between reps: low = every rep alike */
  depthSd: number;
  /** mean range of motion, 0..1 */
  rom: number;
  /** mean key angle at the deepest point, degrees */
  angle?: number;
  /** mean movement control (DTW smoothness), 0..100 */
  smooth?: number;
  /** mean rep duration, ms */
  repMs: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (v: number, k = 100) => Math.round(v * k) / k;

/** Per exercise of a finished workout: the numbers the movement profile is built from. */
export function moveStats(s: WorkoutSummary): Record<string, MoveStats> {
  const out: Record<string, MoveStats> = {};
  for (const r of s.results) {
    // a plank's "reps" are held seconds: no depth or tempo to speak of
    if (ALL_EXERCISES[r.id]?.hold) continue;
    const reps = r.reps.filter((x) => typeof x.depth === 'number');
    if (!reps.length) continue;
    const depths = reps.map((x) => x.depth!);
    const d = mean(depths);
    const angles = reps.map((x) => x.angle).filter((v): v is number => typeof v === 'number');
    const smooth = reps.map((x) => x.smoothness).filter((v): v is number => typeof v === 'number');
    const stats: MoveStats = {
      reps: reps.length,
      depth: round(d),
      depthSd: round(Math.sqrt(mean(depths.map((v) => (v - d) ** 2)))),
      rom: round(mean(reps.map((x) => x.rom ?? x.depth!))),
      repMs: Math.round(mean(reps.map((x) => x.endT - x.startT))),
      ...(angles.length ? { angle: Math.round(mean(angles)) } : {}),
      ...(smooth.length ? { smooth: Math.round(mean(smooth)) } : {}),
    };
    // a program may repeat an exercise in several steps: one entry per exercise
    const prev = out[r.id];
    out[r.id] = prev ? merge([prev, stats]) : stats;
  }
  return out;
}

/** Rep-weighted average of several sessions' stats. */
function merge(list: MoveStats[]): MoveStats {
  const n = list.reduce((a, s) => a + s.reps, 0);
  const avg = (f: (s: MoveStats) => number | undefined) => {
    const has = list.filter((s) => f(s) !== undefined);
    const w = has.reduce((a, s) => a + s.reps, 0);
    return w ? has.reduce((a, s) => a + f(s)! * s.reps, 0) / w : undefined;
  };
  const angle = avg((s) => s.angle);
  const smooth = avg((s) => s.smooth);
  return {
    reps: n,
    depth: round(avg((s) => s.depth)!),
    depthSd: round(avg((s) => s.depthSd)!),
    rom: round(avg((s) => s.rom)!),
    repMs: Math.round(avg((s) => s.repMs)!),
    ...(angle !== undefined ? { angle: Math.round(angle) } : {}),
    ...(smooth !== undefined ? { smooth: Math.round(smooth) } : {}),
  };
}

export type Tempo = 'fast' | 'steady' | 'slow';

export interface ExerciseProfile {
  id: string;
  sessions: number;
  reps: number;
  /** mean depth, % of the full movement */
  depthPct: number;
  /** mean key angle at the deepest point, degrees */
  angle?: number;
  /** mean range of motion, % */
  romPct: number;
  /**
   * 0..100: how alike and controlled the reps are — the movement control (smoothness) and the
   * rep-to-rep consistency of the depth, averaged
   */
  stability: number;
  /** seconds per rep */
  repSec: number;
  tempo: Tempo;
  /** depth change, percentage points: latest session vs the earlier ones (null = one session) */
  depthTrend: number | null;
  /** the most frequent technique errors of this exercise: rule id → share of reps 0..1 */
  errors: { id: string; rate: number }[];
}

/** a depth spread of 0.25 (a quarter of the full movement) between reps = not stable at all */
const SD_UNSTABLE = 0.25;

/** seconds per rep below which a rep is rushed / above which it drags, per exercise */
const TEMPO_BANDS: Record<string, readonly [number, number]> = {
  jumpingJack: [0.45, 2], // a jumping jack is a quick, bouncy move by nature
  sideBend: [1, 4],
};

export function tempoOf(repSec: number, id = ''): Tempo {
  const [fast, slow] = TEMPO_BANDS[id] ?? [1.3, 3.5];
  return repSec < fast ? 'fast' : repSec > slow ? 'slow' : 'steady';
}

/**
 * The player's individual movement profile, built up over time from the workout history: per
 * exercise the average depth, range of motion, stability, tempo and the typical errors, over the
 * last `window` sessions with that exercise. Most-practised exercise first.
 */
export function movementProfile(history: readonly HistoryEntry[], window = 10): ExerciseProfile[] {
  const ids = [...new Set(history.flatMap((h) => Object.keys(h.moves ?? {})))];
  return ids
    .map((id): ExerciseProfile => {
      const sessions = history.filter((h) => h.moves?.[id]).slice(-window);
      const stats = sessions.map((h) => h.moves![id]!);
      const all = merge(stats);
      const consistency = 100 * (1 - Math.min(1, all.depthSd / SD_UNSTABLE));
      const stability = Math.round(
        all.smooth !== undefined ? (all.smooth + consistency) / 2 : consistency,
      );
      const repSec = round(all.repMs / 1000, 10);
      const earlier = stats.slice(0, -1);
      const depthTrend = earlier.length
        ? Math.round(100 * (stats.at(-1)!.depth - merge(earlier).depth))
        : null;
      // errors: their share of this exercise's reps, averaged over the same sessions
      const ruleIds = new Set(
        sessions.flatMap((h) =>
          Object.keys(h.errorRates ?? {}).filter((r) => r.split('.')[0] === id),
        ),
      );
      const errors = [...ruleIds]
        .map((r) => ({ id: r, rate: round(mean(sessions.map((h) => h.errorRates?.[r] ?? 0))) }))
        .filter((e) => e.rate >= 0.1)
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 3);
      return {
        id,
        sessions: sessions.length,
        reps: all.reps,
        depthPct: Math.round(100 * all.depth),
        ...(all.angle !== undefined ? { angle: all.angle } : {}),
        romPct: Math.round(100 * all.rom),
        stability,
        repSec,
        tempo: tempoOf(repSec, id),
        depthTrend,
        errors,
      };
    })
    .sort((a, b) => b.reps - a.reps);
}

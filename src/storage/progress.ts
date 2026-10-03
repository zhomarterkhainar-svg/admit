import type { WorkoutSummary } from '@/game/summary';
import { moveStats, type MoveStats } from '@/game/movementProfile';
import { bodyStats, type BodyStats } from '@/game/bodyProfile';

/** Compact record kept in history (no per-rep data). */
export interface HistoryEntry {
  at: number;
  programId: string;
  counted: number;
  attempted: number;
  quality: number;
  cleanPct: number;
  xp: number;
  durationMs: number;
  /** attempted reps (held seconds for a plank) per exercise id in this session */
  tried?: Record<string, number>;
  /** technique rule id → share (0..1) of that exercise's reps in this session with the error */
  errorRates?: Record<string, number>;
  /** exercise id → depth, range of motion, stability and tempo in this session (movement profile) */
  moves?: Record<string, MoveStats>;
  /** whole-body qualities of this session (QOZĞAL Movement Profile) */
  body?: BodyStats;
}

export interface ScoreEntry {
  name: string;
  score: number;
  at: number;
  mode: 'challenge' | 'workout' | 'dance';
}

export const SCORE_MODES: readonly ScoreEntry['mode'][] = ['challenge', 'workout', 'dance'];

/** Lifetime counters that drive achievements. */
export interface LifetimeStats {
  totalReps: number;
  cleanReps: number;
  /** exercise ids ever completed at least once */
  exercises: string[];
  workouts: number;
  freeWorkouts: number;
  challenges: number;
  /** Qara Zhorga songs danced */
  dances: number;
  bestCombo: number;
  bestCleanStreak: number;
  questsDone: number;
}

export interface Streak {
  days: number;
  /** local YYYY-MM-DD of the last active day */
  lastDay: string | null;
}

export interface QuestState {
  day: string;
  progress: number;
  done: boolean;
}

export interface Progress {
  totalXp: number;
  history: HistoryEntry[];
  scores: ScoreEntry[];
  playerName: string | null;
  stats: LifetimeStats;
  streak: Streak;
  quest: QuestState | null;
  /** achievement id → unlock timestamp */
  achievements: Record<string, number>;
}

const KEY = 'qozgal.progress.v1';
export const EMPTY_STATS: LifetimeStats = {
  totalReps: 0,
  cleanReps: 0,
  exercises: [],
  workouts: 0,
  freeWorkouts: 0,
  challenges: 0,
  dances: 0,
  bestCombo: 0,
  bestCleanStreak: 0,
  questsDone: 0,
};
const EMPTY: Progress = {
  totalXp: 0,
  history: [],
  scores: [],
  playerName: null,
  stats: EMPTY_STATS,
  streak: { days: 0, lastDay: null },
  quest: null,
  achievements: {},
};

/** Storage can be unavailable (private mode, blocked cookies) — never let that break the app. */
export function loadProgress(
  storage: Pick<Storage, 'getItem'> | undefined = safeStorage(),
): Progress {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const p = JSON.parse(raw) as Partial<Progress>;
    return {
      totalXp: Number(p.totalXp) || 0,
      history: Array.isArray(p.history) ? p.history : [],
      scores: Array.isArray(p.scores) ? p.scores : [],
      playerName: typeof p.playerName === 'string' ? p.playerName : null,
      // fields added later: merge with defaults so old saves keep working
      stats: { ...EMPTY_STATS, ...(p.stats ?? {}) },
      streak: p.streak && typeof p.streak.days === 'number' ? p.streak : { days: 0, lastDay: null },
      quest: p.quest ?? null,
      achievements: p.achievements && typeof p.achievements === 'object' ? p.achievements : {},
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function saveProgress(
  p: Progress,
  storage: Pick<Storage, 'setItem'> | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota / disabled storage: progress stays in memory */
  }
}

/**
 * Per exercise: how many reps were tried and, for every technique rule, which share of them had
 * that error. Framing problems (setup.*) and "wrong exercise" are not technique and are skipped.
 */
export function errorStats(s: WorkoutSummary): Pick<HistoryEntry, 'tried' | 'errorRates'> {
  const tried: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const r of s.results) {
    tried[r.id] = (tried[r.id] ?? 0) + r.reps.length;
    for (const rep of r.reps)
      for (const id of new Set(rep.errors)) {
        if (id.startsWith('setup.') || id === 'wrongExercise') continue;
        counts[id] = (counts[id] ?? 0) + 1;
      }
  }
  const errorRates: Record<string, number> = {};
  for (const [id, n] of Object.entries(counts)) {
    const of = tried[id.split('.')[0]!];
    if (of) errorRates[id] = Math.min(1, n / of);
  }
  return { tried, errorRates };
}

export function recordWorkout(p: Progress, s: WorkoutSummary, name: string): Progress {
  const entry: HistoryEntry = {
    at: s.startedAt,
    programId: s.programId,
    counted: s.counted,
    attempted: s.attempted,
    quality: s.quality,
    cleanPct: s.cleanPct,
    xp: s.xp,
    durationMs: s.durationMs,
    ...errorStats(s),
    moves: moveStats(s),
    body: bodyStats(s),
  };
  return {
    ...p,
    totalXp: p.totalXp + s.xp,
    history: [...p.history, entry].slice(-50),
    scores: addScore(p.scores, { name, score: s.xp, at: s.startedAt, mode: 'workout' }),
  };
}

export function recordChallenge(
  p: Progress,
  score: number,
  name: string,
  at: number,
  xp: number,
): Progress {
  return recordScore(p, 'challenge', score, name, at, xp);
}

/** A game score (challenge, dance) on the device board, plus the XP it earned. */
export function recordScore(
  p: Progress,
  mode: ScoreEntry['mode'],
  score: number,
  name: string,
  at: number,
  xp: number,
): Progress {
  return {
    ...p,
    totalXp: p.totalXp + xp,
    scores: addScore(p.scores, { name, score, at, mode }),
  };
}

const WEEK_MS = 8 * 86_400_000;

/**
 * Keeps the all-time top 20 per mode AND every score from the last ~week (so the
 * 'today' / 'week' boards never lose a fresh but modest score), capped at 200 per mode.
 */
function addScore(scores: ScoreEntry[], e: ScoreEntry): ScoreEntry[] {
  const all = [...scores, e];
  return SCORE_MODES.flatMap((mode) => {
    const ofMode = all.filter((s) => s.mode === mode).sort((a, b) => b.score - a.score);
    const top = new Set(ofMode.slice(0, 20));
    return ofMode.filter((s) => top.has(s) || e.at - s.at <= WEEK_MS).slice(0, 200);
  });
}

/** The player renamed themselves: their scores on this device follow the new name. */
export function renameScores(p: Progress, from: string, to: string): Progress {
  return { ...p, scores: p.scores.map((s) => (s.name === from ? { ...s, name: to } : s)) };
}

export function topScores(p: Progress, mode: ScoreEntry['mode'], n = 10): ScoreEntry[] {
  return p.scores
    .filter((s) => s.mode === mode)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

/** Is `score` a new personal best for this device in `mode`? */
export function isRecord(p: Progress, mode: ScoreEntry['mode'], score: number): boolean {
  return score > 0 && topScores(p, mode, 1).every((s) => score > s.score);
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

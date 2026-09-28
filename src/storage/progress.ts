import type { WorkoutSummary } from '@/game/summary';

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
}

export interface ScoreEntry {
  name: string;
  score: number;
  at: number;
  mode: 'challenge' | 'workout';
}

export interface Progress {
  totalXp: number;
  history: HistoryEntry[];
  scores: ScoreEntry[];
  playerName: string | null;
}

const KEY = 'qozgal.progress.v1';
const EMPTY: Progress = { totalXp: 0, history: [], scores: [], playerName: null };

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
  return {
    ...p,
    totalXp: p.totalXp + xp,
    scores: addScore(p.scores, { name, score, at, mode: 'challenge' }),
  };
}

function addScore(scores: ScoreEntry[], e: ScoreEntry): ScoreEntry[] {
  const all = [...scores, e];
  // keep the top 20 per mode
  return (['challenge', 'workout'] as const).flatMap((mode) =>
    all
      .filter((s) => s.mode === mode)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20),
  );
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

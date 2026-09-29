import type { HistoryEntry } from '@/storage/progress';

/** How one technique error changed: its share of the exercise's reps now vs before. */
export interface ErrorTrend {
  id: string;
  /** share (0..1) in the last session; null if the exercise was not done then */
  now: number | null;
  /** mean share over up to `window` earlier sessions with this exercise; null = no history yet */
  before: number | null;
}

const exerciseOf = (ruleId: string) => ruleId.split('.')[0]!;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** sessions that included the rule's exercise (an error that did not show up counts as 0) */
const withExercise = (history: readonly HistoryEntry[], id: string) =>
  history.filter((h) => (h.tried?.[exerciseOf(id)] ?? 0) > 0);
const rate = (h: HistoryEntry, id: string) => h.errorRates?.[id] ?? 0;

function ruleIds(history: readonly HistoryEntry[]): string[] {
  return [...new Set(history.flatMap((h) => Object.keys(h.errorRates ?? {})))];
}

/**
 * "Knees cave in: 40% of reps before → 10% now". For every error ever seen: its share in the
 * latest session against the average of the previous (up to 5) sessions with that exercise.
 * Sorted by how common it used to be.
 */
export function errorProgress(history: readonly HistoryEntry[], window = 5): ErrorTrend[] {
  const last = history.at(-1);
  const earlier = history.slice(0, -1);
  return ruleIds(history)
    .map((id) => {
      const prev = withExercise(earlier, id).slice(-window);
      return {
        id,
        now: last && (last.tried?.[exerciseOf(id)] ?? 0) > 0 ? rate(last, id) : null,
        before: prev.length ? mean(prev.map((h) => rate(h, id))) : null,
      };
    })
    .sort((a, b) => (b.before ?? -1) - (a.before ?? -1));
}

/** One error over the player's whole history: the first sessions against the latest ones. */
export interface ErrorJourney {
  id: string;
  first: number;
  last: number;
  /** how many reps had this error in total (to pick the most common ones) */
  total: number;
}

/**
 * "Work on mistakes" for the profile: the most frequent errors, the first `n` sessions with
 * their exercise against the last `n` (halves when there are fewer than 2n sessions).
 */
export function errorJourney(history: readonly HistoryEntry[], n = 3, limit = 4): ErrorJourney[] {
  return ruleIds(history)
    .map((id) => {
      const s = withExercise(history, id);
      const k = Math.min(n, Math.floor(s.length / 2));
      const total = s.reduce((sum, h) => sum + rate(h, id) * (h.tried?.[exerciseOf(id)] ?? 0), 0);
      return k < 1
        ? null
        : {
            id,
            first: mean(s.slice(0, k).map((h) => rate(h, id))),
            last: mean(s.slice(-k).map((h) => rate(h, id))),
            total: Math.round(total),
          };
    })
    .filter((j): j is ErrorJourney => j !== null && j.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

import type { ExerciseId } from '@/exercises/registry';
import type { Progress } from '@/storage/progress';
import { unlockAchievements, type AchievementDef } from './achievements';
import { advanceQuest, dayKey, updateStreak, type QuestDef } from './daily';
import type { WorkoutSummary } from './summary';

export interface SessionOutcome {
  progress: Progress;
  unlocked: AchievementDef[];
  /** quest finished by this session (its XP is already added) */
  questCompleted: QuestDef | null;
}

/**
 * Everything that happens after a session besides the raw record: lifetime stats, day streak,
 * quest of the day (+XP) and achievements. Pure — easy to test, no storage access.
 */
export function applySession(
  p: Progress,
  session: {
    workout?: WorkoutSummary;
    challenge?: { bestCombo: number; hits: number };
    now: number;
  },
): SessionOutcome {
  const today = dayKey(session.now);
  const stats = { ...p.stats };
  const byExercise: Partial<Record<ExerciseId, number>> = {};

  // a session without a single counted rep / hit is not activity: no stats, streak or badges
  const active = (session.workout?.counted ?? 0) > 0 || (session.challenge?.hits ?? 0) > 0;
  if (!active) return { progress: p, unlocked: [], questCompleted: null };

  if (session.workout) {
    const w = session.workout;
    stats.workouts++;
    if (w.programId === 'free') stats.freeWorkouts++;
    stats.totalReps += w.counted;
    stats.cleanReps += w.results
      .flatMap((r) => r.reps)
      .filter((r) => r.counted && r.errors.length === 0).length;
    stats.bestCleanStreak = Math.max(stats.bestCleanStreak, w.bestCleanStreak);
    for (const r of w.results) {
      const n = r.reps.filter((x) => x.counted).length;
      if (n > 0) {
        byExercise[r.id] = (byExercise[r.id] ?? 0) + n;
        if (!stats.exercises.includes(r.id)) stats.exercises = [...stats.exercises, r.id];
      }
    }
  }
  if (session.challenge) {
    stats.challenges++;
    stats.bestCombo = Math.max(stats.bestCombo, session.challenge.bestCombo);
  }

  const streak = updateStreak(p.streak, today);
  const q = advanceQuest(p.quest, today, byExercise);
  let totalXp = p.totalXp;
  if (q.completed) {
    stats.questsDone++;
    totalXp += q.def.xp;
  }
  const { progress, unlocked } = unlockAchievements(
    { ...p, stats, streak, quest: q.quest, totalXp },
    session.now,
  );
  return { progress, unlocked, questCompleted: q.completed ? q.def : null };
}

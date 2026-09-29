import type { AnyExerciseId, ExerciseId } from '@/exercises/registry';
import type { QuestState, Streak } from '@/storage/progress';

/** Local calendar day, YYYY-MM-DD. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return dayKey(new Date(y, m - 1, d - 1).getTime());
}

/** Consecutive active days: same day keeps it, the next day grows it, a gap resets to 1. */
export function updateStreak(s: Streak, today: string): Streak {
  if (s.lastDay === today) return s;
  if (s.lastDay && prevDay(today) === s.lastDay) return { days: s.days + 1, lastDay: today };
  return { days: 1, lastDay: today };
}

export interface QuestDef {
  exercise: ExerciseId;
  target: number;
  xp: number;
}

const QUESTS: QuestDef[] = [
  { exercise: 'squat', target: 15, xp: 60 },
  { exercise: 'jumpingJack', target: 20, xp: 60 },
  { exercise: 'lunge', target: 10, xp: 60 },
  { exercise: 'press', target: 15, xp: 60 },
  { exercise: 'sideBend', target: 12, xp: 60 },
];

/** Deterministic quest of the day: everyone gets the same one on the same date. */
export function questFor(day: string): QuestDef {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return QUESTS[h % QUESTS.length]!;
}

/** Adds today's reps of the quest exercise; reports when the quest was just completed. */
export function advanceQuest(
  q: QuestState | null,
  today: string,
  countedByExercise: Partial<Record<AnyExerciseId, number>>,
): { quest: QuestState; completed: boolean; def: QuestDef } {
  const def = questFor(today);
  const cur = q && q.day === today ? q : { day: today, progress: 0, done: false };
  if (cur.done) return { quest: cur, completed: false, def };
  const progress = Math.min(def.target, cur.progress + (countedByExercise[def.exercise] ?? 0));
  const done = progress >= def.target;
  return { quest: { day: today, progress, done }, completed: done, def };
}

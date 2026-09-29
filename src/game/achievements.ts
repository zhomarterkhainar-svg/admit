import type { I18nKey } from '@/i18n';
import type { Progress } from '@/storage/progress';
import type { GameIconId } from './icons';

export interface AchievementDef {
  id: string;
  icon: GameIconId;
  title: I18nKey;
  desc: I18nKey;
  test(p: Progress): boolean;
}

const best = (p: Progress, mode: 'challenge' | 'workout') =>
  Math.max(0, ...p.scores.filter((s) => s.mode === mode).map((s) => s.score));

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first',
    icon: 'sprout',
    title: 'ach.first',
    desc: 'ach.first.desc',
    test: (p) => p.stats.workouts >= 1,
  },
  {
    id: 'flawless',
    icon: 'gem',
    title: 'ach.flawless',
    desc: 'ach.flawless.desc',
    test: (p) => p.history.some((h) => h.counted >= 5 && h.cleanPct === 100),
  },
  {
    id: 'century',
    icon: 'hundred',
    title: 'ach.century',
    desc: 'ach.century.desc',
    test: (p) => p.stats.totalReps >= 100,
  },
  {
    id: 'allRounder',
    icon: 'target',
    title: 'ach.allRounder',
    desc: 'ach.allRounder.desc',
    test: (p) => p.stats.exercises.length >= 5,
  },
  {
    id: 'cleanStreak',
    icon: 'flame',
    title: 'ach.cleanStreak',
    desc: 'ach.cleanStreak.desc',
    test: (p) => p.stats.bestCleanStreak >= 10,
  },
  {
    id: 'streak3',
    icon: 'calendar',
    title: 'ach.streak3',
    desc: 'ach.streak3.desc',
    test: (p) => p.streak.days >= 3,
  },
  {
    id: 'aiFriend',
    icon: 'bot',
    title: 'ach.aiFriend',
    desc: 'ach.aiFriend.desc',
    test: (p) => p.stats.freeWorkouts >= 1,
  },
  {
    id: 'combo5',
    icon: 'zap',
    title: 'ach.combo5',
    desc: 'ach.combo5.desc',
    test: (p) => p.stats.bestCombo >= 5,
  },
  {
    id: 'sniper',
    icon: 'crosshair',
    title: 'ach.sniper',
    desc: 'ach.sniper.desc',
    test: (p) => best(p, 'challenge') >= 1000,
  },
  {
    id: 'quest',
    icon: 'scroll',
    title: 'ach.quest',
    desc: 'ach.quest.desc',
    test: (p) => p.stats.questsDone >= 1,
  },
  { id: 'er', icon: 'shield', title: 'ach.er', desc: 'ach.er.desc', test: (p) => p.totalXp >= 500 },
];

/** Marks newly earned achievements; returns the updated progress and the new ids. */
export function unlockAchievements(
  p: Progress,
  now: number,
): { progress: Progress; unlocked: AchievementDef[] } {
  const unlocked = ACHIEVEMENTS.filter((a) => !p.achievements[a.id] && a.test(p));
  if (!unlocked.length) return { progress: p, unlocked };
  const achievements = { ...p.achievements };
  for (const a of unlocked) achievements[a.id] = now;
  return { progress: { ...p, achievements }, unlocked };
}

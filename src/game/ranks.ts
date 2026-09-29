import type { I18nKey } from '@/i18n';
import type { GameIconId } from './icons';

export interface Rank {
  key: I18nKey;
  minXp: number;
  icon: GameIconId;
}

/** Path of the Batyr: young warrior → batyr → hero → giant. */
export const RANKS: Rank[] = [
  { key: 'rank.zhas', minXp: 0, icon: 'sprout' },
  { key: 'rank.batyr', minXp: 150, icon: 'bow' },
  { key: 'rank.er', minXp: 500, icon: 'shield' },
  { key: 'rank.alyp', minXp: 1200, icon: 'eagle' },
];

export function rankFor(xp: number): { rank: Rank; next: Rank | null; progress: number } {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1]!.minXp) i++;
  const rank = RANKS[i]!;
  const next = RANKS[i + 1] ?? null;
  const progress = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1;
  return { rank, next, progress };
}

import { describe, expect, it } from 'vitest';
import type { RepSummary } from '@/engine/types';
import { loadProgress } from '@/storage/progress';
import { advanceQuest, dayKey, questFor, updateStreak } from './daily';
import { applySession } from './progression';
import { summarize } from './summary';

const rep = (counted = true, errors: string[] = []): RepSummary => ({
  index: 0,
  startT: 0,
  endT: 1,
  counted,
  quality: 100,
  errors,
});
const day = (s: string) => new Date(`${s}T12:00:00`).getTime();

describe('daily streak', () => {
  it('grows on consecutive days, keeps within a day, resets after a gap', () => {
    let s = updateStreak({ days: 0, lastDay: null }, '2026-09-28');
    expect(s.days).toBe(1);
    expect(updateStreak(s, '2026-09-28').days).toBe(1);
    s = updateStreak(s, '2026-09-29');
    expect(s.days).toBe(2);
    expect(updateStreak(s, '2026-10-01').days).toBe(1);
  });
  it('handles month boundaries', () => {
    expect(updateStreak({ days: 4, lastDay: '2026-09-30' }, '2026-10-01').days).toBe(5);
  });
});

describe('quest of the day', () => {
  it('is deterministic per day and completes once', () => {
    expect(questFor('2026-09-29')).toEqual(questFor('2026-09-29'));
    const def = questFor('2026-09-29');
    let r = advanceQuest(null, '2026-09-29', { [def.exercise]: def.target - 1 });
    expect(r.completed).toBe(false);
    r = advanceQuest(r.quest, '2026-09-29', { [def.exercise]: 5 });
    expect(r.completed).toBe(true);
    expect(advanceQuest(r.quest, '2026-09-29', { [def.exercise]: 5 }).completed).toBe(false);
    expect(advanceQuest(r.quest, '2026-09-30', {}).quest.progress).toBe(0);
  });
});

describe('applySession', () => {
  const empty = () => loadProgress(undefined);

  it('first workout: stats, streak and the "first" achievement', () => {
    const w = summarize(
      'quick',
      [{ id: 'squat', target: 3, durationMs: 1, reps: [rep(), rep(), rep(true, ['squat.torso'])] }],
      0,
      60_000,
    );
    const out = applySession({ ...empty(), totalXp: w.xp }, { workout: w, now: day('2026-09-29') });
    expect(out.progress.stats.totalReps).toBe(3);
    expect(out.progress.stats.exercises).toEqual(['squat']);
    expect(out.progress.streak).toEqual({ days: 1, lastDay: '2026-09-29' });
    expect(out.unlocked.map((a) => a.id)).toContain('first');
    expect(
      applySession(out.progress, { workout: w, now: day('2026-09-29') }).unlocked.map((a) => a.id),
    ).not.toContain('first');
  });

  it('completing the quest adds XP and unlocks the quest badge', () => {
    const today = '2026-09-29';
    const def = questFor(today);
    const reps = Array.from({ length: def.target }, () => rep());
    const w = summarize(
      'single',
      [{ id: def.exercise, target: def.target, durationMs: 1, reps }],
      0,
      60_000,
    );
    const before = empty();
    const out = applySession(before, { workout: w, now: day(today) });
    expect(out.questCompleted?.exercise).toBe(def.exercise);
    expect(out.progress.totalXp).toBe(before.totalXp + def.xp);
    expect(out.unlocked.map((a) => a.id)).toEqual(expect.arrayContaining(['quest', 'cleanStreak']));
  });

  it('challenge combo unlocks combo5; dayKey is local', () => {
    const out = applySession(empty(), { challenge: { bestCombo: 6 }, now: day('2026-09-29') });
    expect(out.unlocked.map((a) => a.id)).toContain('combo5');
    expect(dayKey(day('2026-09-29'))).toBe('2026-09-29');
  });

  it('old saves without the new fields still load', () => {
    const m = new Map([
      ['qozgal.progress.v1', JSON.stringify({ totalXp: 10, history: [], scores: [] })],
    ]);
    const p = loadProgress({ getItem: (k: string) => m.get(k) ?? null });
    expect(p.stats.totalReps).toBe(0);
    expect(p.achievements).toEqual({});
  });
});

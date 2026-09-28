import { describe, expect, it } from 'vitest';
import { summarize } from '@/game/summary';
import {
  isRecord,
  loadProgress,
  recordChallenge,
  recordWorkout,
  saveProgress,
  topScores,
} from './progress';
import { nextBatyrName, randomBatyrName } from './names';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};

describe('progress storage', () => {
  it('round-trips and survives garbage', () => {
    const st = memory();
    expect(loadProgress(st).totalXp).toBe(0);
    st.setItem('qozgal.progress.v1', '{not json');
    expect(loadProgress(st).history).toEqual([]);
    const s = summarize('quick', [], 0, 60000);
    const p = recordWorkout(loadProgress(st), { ...s, xp: 42 }, 'Қабанбай-12');
    saveProgress(p, st);
    expect(loadProgress(st).totalXp).toBe(42);
    expect(loadProgress(st).history).toHaveLength(1);
  });

  it('keeps top challenge scores and detects records', () => {
    let p = loadProgress(memory());
    expect(isRecord(p, 'challenge', 100)).toBe(true);
    p = recordChallenge(p, 100, 'A', 1, 10);
    p = recordChallenge(p, 300, 'B', 2, 10);
    expect(topScores(p, 'challenge').map((s) => s.name)).toEqual(['B', 'A']);
    expect(isRecord(p, 'challenge', 200)).toBe(false);
    expect(isRecord(p, 'challenge', 301)).toBe(true);
    expect(p.totalXp).toBe(20);
  });

  it('works without any storage', () => {
    expect(loadProgress(undefined).totalXp).toBe(0);
    expect(() => saveProgress(loadProgress(undefined), undefined)).not.toThrow();
  });
});

describe('batyr names', () => {
  it('generates and cycles names', () => {
    const n = randomBatyrName(() => 0);
    expect(n).toBe('Қабанбай-10');
    expect(nextBatyrName(n, 1, () => 0)).toBe('Бөгенбай-10');
    expect(nextBatyrName(n, -1, () => 0)).toBe('Гүлбаршын-10');
  });
});

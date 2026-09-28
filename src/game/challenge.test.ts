import { describe, expect, it } from 'vitest';
import type { RepSummary } from '@/engine/types';
import { ChallengeGame, DEFAULT_CHALLENGE } from './challenge';

const rep = (counted = true, errors: string[] = [], side?: 'l' | 'r'): RepSummary => ({
  index: 0,
  startT: 0,
  endT: 0,
  counted,
  quality: counted ? 100 : 0,
  errors,
  side,
});

/** deterministic rand cycling through the given values */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length]!;
};

describe('ChallengeGame', () => {
  it('issues a command, scores a clean hit and grows combo', () => {
    const g = new ChallengeGame(DEFAULT_CHALLENGE, seq(0, 0.25));
    const ev = g.start(0);
    expect(ev[0]).toMatchObject({ type: 'command' });
    expect(g.command!.def.id).toBe('squat');
    const hit = g.rep(rep(), 1000);
    expect(hit[0]).toMatchObject({ type: 'hit', clean: true, combo: 1 });
    expect(g.score).toBeGreaterThan(150);
    expect(g.command).toBeNull();
    g.tick(1000 + DEFAULT_CHALLENGE.gapMs);
    expect(g.command!.def.id).toBe('jumpingJack');
  });

  it('a not-counted rep keeps the command and resets combo without costing a life', () => {
    const g = new ChallengeGame(DEFAULT_CHALLENGE, seq(0));
    g.start(0);
    g.rep(rep(), 500);
    g.tick(2000);
    const ev = g.rep(rep(false, ['squat.depth']), 2500);
    expect(ev[0]!.type).toBe('almost');
    expect(g.combo).toBe(0);
    expect(g.lives).toBe(3);
    expect(g.command).not.toBeNull();
  });

  it('timeouts cost lives and end the game', () => {
    const g = new ChallengeGame({ ...DEFAULT_CHALLENGE, gapMs: 0 }, seq(0.1));
    g.start(0);
    const all = [];
    for (let t = 0; t < 30_000 && !g.over; t += 100) all.push(...g.tick(t));
    expect(all.filter((e) => e.type === 'miss')).toHaveLength(3);
    expect(all.at(-1)).toEqual({ type: 'over', reason: 'lives' });
  });

  it('side commands require the right side', () => {
    const g = new ChallengeGame(DEFAULT_CHALLENGE, seq(0.7)); // bendLeft
    g.start(0);
    expect(g.command!.def.id).toBe('bendLeft');
    expect(g.rep(rep(true, [], 'r'), 500)[0]!.type).toBe('wrongSide');
    expect(g.rep(rep(true, [], 'l'), 900)[0]!.type).toBe('hit');
  });

  it('ends on time and computes xp', () => {
    const g = new ChallengeGame(DEFAULT_CHALLENGE, seq(0));
    g.start(0);
    g.rep(rep(), 100);
    expect(g.tick(60_000)).toEqual([{ type: 'over', reason: 'time' }]);
    expect(g.xp()).toBe(Math.round(g.score / 20));
  });

  it('combo multiplier caps at x4', () => {
    const g = new ChallengeGame({ ...DEFAULT_CHALLENGE, gapMs: 0, durationMs: 1e9 }, seq(0));
    g.start(0);
    for (let i = 0; i < 12; i++) {
      g.tick(i * 1000);
      g.rep(rep(), i * 1000 + 10);
    }
    expect(g.multiplier).toBe(4);
    expect(g.bestCombo).toBe(12);
  });
});

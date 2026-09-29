import { describe, expect, it } from 'vitest';
import { BEAT_MS, SONG_MS, chart, type Note } from './chart';
import { DanceJudge, gradeFor, multiplier } from './judge';
import type { MoveId } from './moves';

/** A dancer who holds each note's move from `shift − hold` to `shift + hold` around its beat. */
function play(notes: Note[], shift: number, hold = 100, wrong = false) {
  const judge = new DanceJudge(notes);
  const events = [];
  for (let ms = 0; ms <= SONG_MS + 1000; ms += 33) {
    const now = notes.find((n) => Math.abs(ms - (n.t + shift)) <= hold);
    const move: MoveId | null = now ? (wrong ? (now.move === 'squat' ? 'up' : 'squat') : now.move) : null;
    events.push(...judge.update(ms, (m) => m === move));
  }
  return { judge, events };
}

describe('dance chart', () => {
  it('72 s at 120 BPM; a move every 2 beats (medium) or 4 (easy), none in intro/outro', () => {
    expect(SONG_MS).toBe(72_000);
    const mid = chart('mid');
    const easy = chart('easy');
    expect(mid).toHaveLength(64);
    expect(easy).toHaveLength(32);
    expect(mid[0]).toMatchObject({ beat: 8, t: 8 * BEAT_MS, move: 'reins' });
    expect(mid.at(-1)!.beat).toBeLessThan(136);
    expect(mid[1]!.t - mid[0]!.t).toBe(2 * BEAT_MS);
  });
});

describe('dance judge', () => {
  it('poses right on the beat: all perfect, combo grows, grade S', () => {
    const { judge } = play(chart('mid'), 0);
    expect(judge.counts).toEqual({ perfect: 64, good: 0, miss: 0 });
    expect(judge.bestCombo).toBe(64);
    expect(judge.grade).toBe('S');
  });

  it('250 ms late: good', () => {
    const { judge } = play(chart('easy'), 250);
    expect(judge.counts).toEqual({ perfect: 0, good: 32, miss: 0 });
    expect(judge.grade).toBe('C');
  });

  it('the wrong move: a miss', () => {
    const { judge } = play(chart('easy'), 0, 100, true);
    expect(judge.counts.miss).toBe(32);
    expect(judge.score).toBe(0);
  });

  it('holding the pose through the beat is a perfect, awarded at once', () => {
    const [n] = chart('easy');
    const judge = new DanceJudge([n!]);
    expect(judge.update(n!.t - 300, (m) => m === n!.move)).toEqual([]); // early: wait
    const [e] = judge.update(n!.t - 60, (m) => m === n!.move);
    expect(e).toMatchObject({ hit: 'perfect', points: 100, combo: 1 });
  });

  it('no dancer in view: the notes close as misses', () => {
    const notes = chart('easy');
    const judge = new DanceJudge(notes);
    judge.advance(SONG_MS);
    expect(judge.counts.miss).toBe(notes.length);
    expect(judge.over).toBe(true);
  });

  it('score multiplier grows every 8 in a row, up to ×4', () => {
    expect([0, 7, 8, 16, 24, 40].map(multiplier)).toEqual([1, 1, 2, 3, 4, 4]);
    const { judge } = play(chart('mid'), 0);
    // 8×100 + 8×200 + 8×300 + 40×400
    expect(judge.score).toBe(800 + 1600 + 2400 + 40 * 400);
  });

  it('the demo dancer is judged like a person: mostly perfect, some late, some wrong', async () => {
    const { demoDancePose } = await import('./demo');
    const { extractFeatures } = await import('@/core/features/extract');
    const { makePose } = await import('@/core/reference/template');
    const { MOVES } = await import('./moves');
    const notes = chart('mid');
    const pose = demoDancePose(notes);
    const judge = new DanceJudge(notes);
    for (let ms = 0; ms <= SONG_MS; ms += 33) {
      const frame = makePose(pose(ms), ms);
      const f = extractFeatures(frame);
      judge.update(ms, (m) => MOVES[m].match(f, frame));
    }
    expect(judge.counts.perfect).toBeGreaterThan(50);
    expect(judge.counts.good).toBeGreaterThan(0); // the late ones
    expect(judge.counts.miss).toBeGreaterThan(0); // the wrong ones
  });

  it('grades by accuracy', () => {
    expect([0.96, 0.9, 0.75, 0.55, 0.3].map(gradeFor)).toEqual(['S', 'A', 'B', 'C', 'D']);
  });
});

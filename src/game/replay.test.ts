import { describe, expect, it } from 'vitest';
import { makePose } from '@/core/reference/template';
import type { RepSummary } from '@/engine/types';
import { EXERCISES } from '@/exercises/registry';
import { REPLAY_POST_MS, REPLAY_PRE_MS, ReplayRecorder, worstRule } from './replay';

const rep = (startT: number, endT: number, counted: boolean, quality: number, errors: string[]) =>
  ({ index: 0, startT, endT, counted, quality, errors }) satisfies RepSummary;

/** 30 fps from `from` to `to` ms; the movement depth peaks in the middle of each second. */
function feed(r: ReplayRecorder, from: number, to: number) {
  for (let t = from; t <= to; t += 33)
    r.push(makePose({}, t), Math.abs(Math.sin((Math.PI * t) / 1000)));
}

describe('slow-motion replay of the worst rep', () => {
  it('picks the most serious error of a rep', () => {
    const squat = EXERCISES.squat;
    expect(worstRule(['squat.tempo', 'squat.depth'], squat)).toBe('squat.depth'); // validity
    expect(worstRule(['squat.tempo'], squat)).toBe('squat.tempo');
    expect(worstRule([], squat)).toBeNull();
  });

  it('cuts [start − 300 ms, end + 200 ms] around the rep, the peak at the deepest frame', () => {
    const r = new ReplayRecorder('squat', EXERCISES.squat);
    feed(r, 0, 2000);
    r.onRep(rep(1000, 2000, true, 80, ['squat.valgus']));
    feed(r, 2033, 3000);
    const replay = r.finish()!;
    expect(replay.frames[0]!.t).toBeGreaterThanOrEqual(1000 - REPLAY_PRE_MS);
    expect(replay.frames.at(-1)!.t).toBeLessThanOrEqual(2000 + REPLAY_POST_MS);
    expect(replay.frames.at(-1)!.t).toBeGreaterThan(2000); // waited for the tail
    expect(replay.frames[replay.peakIndex]!.t).toBeCloseTo(1500, -2);
    expect(replay).toMatchObject({ exercise: 'squat', ruleId: 'squat.valgus', counted: true });
  });

  it('keeps the worst rep: not counted beats counted, then lower quality', () => {
    const r = new ReplayRecorder('squat', EXERCISES.squat);
    feed(r, 0, 1000);
    r.onRep(rep(0, 1000, true, 80, ['squat.valgus']));
    feed(r, 1033, 2000);
    r.onRep(rep(1000, 2000, false, 0, ['squat.depth']));
    feed(r, 2033, 3000);
    r.onRep(rep(2000, 3000, true, 60, ['squat.tempo']));
    feed(r, 3033, 4000);
    expect(r.finish()!.ruleId).toBe('squat.depth');
  });

  it('ignores clean reps', () => {
    const r = new ReplayRecorder('squat', EXERCISES.squat);
    feed(r, 0, 2000);
    r.onRep(rep(500, 1500, true, 100, []));
    feed(r, 2033, 3000);
    expect(r.finish()).toBeNull();
  });

  it('a rep ending with the set is still cut', () => {
    const r = new ReplayRecorder('squat', EXERCISES.squat);
    feed(r, 0, 2000);
    r.onRep(rep(1000, 2000, false, 0, ['squat.depth']));
    expect(r.finish()?.frames.length).toBeGreaterThan(20);
  });
});

import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import { blend, makePose } from '@/core/reference/template';
import { DEMO_MIX } from '@/demo/scripts';
import { FreeWorkoutSession } from './freeWorkout';

describe('FreeWorkoutSession (AI picks the exercise)', () => {
  it('credits each rep of a mixed session to the right exercise', () => {
    const s = new FreeWorkoutSession();
    const switches: string[] = [];
    let t = 0;
    const feed = (edit: Parameters<typeof makePose>[0]) => {
      const st = s.update(extractFeatures(makePose(edit, (t += 33))), 1, t);
      for (const e of st.events) if (e.type === 'switch') switches.push(e.id);
    };
    for (let i = 0; i < 30; i++) feed(DEMO_MIX[0]!.rest);
    for (const r of DEMO_MIX) {
      const n = Math.round(r.ms / 33);
      for (let i = 0; i <= n; i++) feed(blend(r.rest, r.peak, Math.sin((Math.PI * i) / n)));
      for (let i = 0; i < 24; i++) feed(r.rest);
    }
    expect(s.counts()).toEqual({ squat: 2, jumpingJack: 3, lunge: 2, press: 2, sideBend: 2 });
    expect(switches).toEqual(['squat', 'jumpingJack', 'press', 'sideBend', 'lunge']);
  });

  it('shows only framing hints before any exercise is recognized', () => {
    const s = new FreeWorkoutSession();
    const st = s.update(extractFeatures(makePose({}, 0)), 2, 0);
    expect(st.active).toBeNull();
    expect(st.runner?.hint?.severity ?? 'setup').toBe('setup');
  });
});

describe('free workout before recognition', () => {
  it("never gives another exercise's technique advice", () => {
    const s = new FreeWorkoutSession();
    const hints: string[] = [];
    let t = 0;
    // a slow squat: early frames are ambiguous, only framing hints are allowed until recognized
    for (let i = 0; i <= 40; i++) {
      const st = s.update(
        extractFeatures(makePose(blend({}, DEMO_MIX[0]!.peak, i / 40), (t += 33))),
        1,
        t,
      );
      for (const e of st.events) if (e.type === 'hint' && !st.active) hints.push(e.hint.id);
    }
    expect(hints.every((id) => id.startsWith('setup.'))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { blend, makePose } from '@/core/reference/template';
import { EXERCISES, EXERCISE_IDS } from '@/exercises/registry';
import { runExercise } from '../../tests/helpers/run';
import { DEMO_SCRIPTS } from './scripts';

/** The demo must actually show the error mode: every script has counted reps AND detected mistakes. */
describe('demo choreography', () => {
  for (const id of EXERCISE_IDS) {
    it(`${id}: counts good reps and detects the scripted mistakes`, () => {
      const frames = [];
      let t = 0;
      for (let i = 0; i < 12; i++) frames.push(makePose(DEMO_SCRIPTS[id][0]!.rest, (t += 33)));
      for (const r of DEMO_SCRIPTS[id]) {
        const n = Math.round(r.ms / 33);
        for (let i = 0; i <= n; i++)
          frames.push(makePose(blend(r.rest, r.peak, Math.sin((Math.PI * i) / n)), (t += 33)));
        for (let i = 0; i < 21; i++) frames.push(makePose(r.rest, (t += 33)));
      }
      const { reps, errors } = runExercise(EXERCISES[id], frames);
      expect(reps.length, 'every scripted rep is recognized').toBe(DEMO_SCRIPTS[id].length);
      expect(reps.filter((r) => r.counted).length).toBeGreaterThanOrEqual(2);
      expect(
        reps.some((r) => !r.counted),
        'has a not-counted rep',
      ).toBe(true);
      expect(errors.size).toBeGreaterThanOrEqual(1);
    });
  }
});

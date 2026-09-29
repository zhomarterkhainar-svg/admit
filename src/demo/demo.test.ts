import { describe, expect, it } from 'vitest';
import { blend, makePose } from '@/core/reference/template';
import { EXERCISES, EXERCISE_IDS, FLOOR_EXERCISES, FLOOR_EXERCISE_IDS } from '@/exercises/registry';
import { runExercise } from '../../tests/helpers/run';
import { COMMANDS } from '@/game/challenge';
import { DEMO_SCRIPTS, challengeDemo, type DemoRep } from './scripts';

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

function framesFor(script: DemoRep[]) {
  const frames = [];
  let t = 0;
  for (let i = 0; i < 12; i++) frames.push(makePose(script[0]!.rest, (t += 33)));
  for (const r of script) {
    const n = Math.round(r.ms / 33);
    for (let i = 0; i <= n; i++)
      frames.push(makePose(blend(r.rest, r.peak, Math.sin((Math.PI * i) / n)), (t += 33)));
    for (let i = 0; i < 21; i++) frames.push(makePose(r.rest, (t += 33)));
  }
  return { frames, ms: t };
}

/** In the challenge demo the athlete must answer every command in time, on the right side. */
describe('challenge demo', () => {
  for (const cmd of Object.values(COMMANDS)) {
    for (const n of [0, 1]) {
      it(`${cmd.id} #${n}: a counted rep within the shortest (3 s) window`, () => {
        const { frames, ms } = framesFor(challengeDemo(cmd.id, n));
        const { reps } = runExercise(EXERCISES[cmd.exercise], frames);
        const hit = reps.find((r) => r.counted && (!cmd.side || r.side === cmd.side));
        expect(hit, 'a counted rep on the commanded side').toBeDefined();
        expect(hit!.endT - (frames[0]?.t ?? 0) + 350, `reaction ${ms} ms`).toBeLessThan(
          n === 1 ? 5000 : 3000,
        );
      });
    }
  }
});

/** Floor mode demo: reps are counted, mistakes detected; the plank clock runs and sees sagging. */
describe('floor demo choreography', () => {
  for (const id of FLOOR_EXERCISE_IDS) {
    it(`${id}: counts and detects the scripted mistakes`, () => {
      const { frames } = framesFor(DEMO_SCRIPTS[id]);
      const { reps, errors } = runExercise(FLOOR_EXERCISES[id], frames);
      expect(reps.filter((r) => r.counted).length).toBeGreaterThanOrEqual(2);
      expect(errors.size).toBeGreaterThanOrEqual(1);
      if (!FLOOR_EXERCISES[id].hold) {
        expect(reps.length, 'every scripted rep is recognized').toBe(DEMO_SCRIPTS[id].length);
        expect(reps.some((r) => !r.counted)).toBe(true);
      }
    });
  }
});

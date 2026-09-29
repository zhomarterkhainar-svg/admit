import { describe, expect, it } from 'vitest';
import { repSequence } from '@/core/reference/template';
import { runExercise } from '../../tests/helpers/run';
import { ERROR_EXAMPLES } from './errorExamples';
import { ALL_EXERCISES, type AnyExerciseId } from './registry';
import { pressStart } from './press/reference';

/** Each visual example must really trigger its rule, and its "right" pose must not. */
describe('error examples', () => {
  for (const [ruleId, ex] of Object.entries(ERROR_EXAMPLES)) {
    it(ruleId, () => {
      const exId = ruleId.split('.')[0] as AnyExerciseId;
      const def = ALL_EXERCISES[exId];
      // floor exercises start from their own rest pose (e.g. the top of a push-up)
      const start =
        exId === 'press' ? pressStart() : def.posture === 'floor' ? def.keyframes.rest : {};
      const wrong = runExercise(def, repSequence(ex.wrong, { msPerRep: 3000, start }));
      const right = runExercise(def, repSequence(ex.right, { msPerRep: 3000, start }));
      expect([...wrong.errors, ...wrong.hintIds]).toContain(ruleId);
      expect([...right.errors, ...right.hintIds]).not.toContain(ruleId);
    });
  }
});

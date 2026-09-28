import { describe, expect, it } from 'vitest';
import { repSequence } from '@/core/reference/template';
import { runExercise } from '../../tests/helpers/run';
import { ERROR_EXAMPLES } from './errorExamples';
import { EXERCISES, type ExerciseId } from './registry';
import { pressStart } from './press/reference';

/** Each visual example must really trigger its rule, and its "right" pose must not. */
describe('error examples', () => {
  for (const [ruleId, ex] of Object.entries(ERROR_EXAMPLES)) {
    it(ruleId, () => {
      const exId = ruleId.split('.')[0] as ExerciseId;
      const def = EXERCISES[exId];
      const start = exId === 'press' ? pressStart() : {};
      const wrong = runExercise(def, repSequence(ex.wrong, { msPerRep: 3000, start }));
      const right = runExercise(def, repSequence(ex.right, { msPerRep: 3000, start }));
      expect([...wrong.errors, ...wrong.hintIds]).toContain(ruleId);
      expect([...right.errors, ...right.hintIds]).not.toContain(ruleId);
    });
  }
});

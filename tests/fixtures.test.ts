import { describe, expect, it } from 'vitest';
import type { Recording } from '@/dev/recording';
import { EXERCISES, type ExerciseId } from '@/exercises/registry';
import { runExercise } from './helpers/run';

const fixtures = import.meta.glob<Recording>('./fixtures/*.json', {
  eager: true,
  import: 'default',
});
const entries = Object.entries(fixtures);

/** Real recorded movements (see tests/fixtures/README.md). Skipped when there are none. */
describe.skipIf(entries.length === 0)('recorded fixtures', () => {
  for (const [file, rec] of entries) {
    it(file, () => {
      const def = EXERCISES[rec.exercise as ExerciseId];
      expect(def, `unknown exercise ${rec.exercise}`).toBeDefined();
      const { reps, errors } = runExercise(def, rec.frames);
      const counted = reps.filter((r) => r.counted).length;
      const [kind, arg] = rec.label.split(/-(.+)/);
      if (kind === 'good') {
        expect(counted).toBe(Number(arg));
        expect([...errors]).toEqual([]);
      } else if (kind === 'count') {
        expect(counted).toBe(Number(arg));
      } else if (kind === 'bad') {
        for (const id of arg!.split('+')) expect([...errors]).toContain(id);
      }
    });
  }
});

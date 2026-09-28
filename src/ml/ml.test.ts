import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import { repSequence } from '@/core/reference/template';
import { EXERCISES, EXERCISE_IDS } from '@/exercises/registry';
import { DEMO_SCRIPTS } from '@/demo/scripts';
import { KnnClassifier } from './knn';
import { STAND, syntheticSamples } from './dataset';
import { ExerciseRecognizer } from './recognizer';
import { toVector } from './vector';

describe('kNN pose classifier', () => {
  it('is deterministic', () => {
    expect(syntheticSamples(5)).toEqual(syntheticSamples(5));
  });

  it('generalizes to unseen augmented poses (hold-out accuracy ≥ 90%)', () => {
    const clf = new KnnClassifier(7);
    clf.addAll(syntheticSamples(70, 1));
    const test = syntheticSamples(30, 999);
    const correct = test.filter((s) => clf.predict(s.v).label === s.label).length;
    expect(correct / test.length).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies a standing pose as "stand"', () => {
    const clf = new KnnClassifier(7);
    clf.addAll(syntheticSamples());
    const f = extractFeatures(repSequence({}, { reps: 0 })[0]!);
    expect(clf.predict(toVector(f)).label).toBe(STAND);
  });
});

describe('ExerciseRecognizer', () => {
  for (const id of EXERCISE_IDS) {
    it(`recognizes ${id} from a live-like sequence`, () => {
      const rec = new ExerciseRecognizer();
      const script = DEMO_SCRIPTS[id][0]!;
      let best: string | null = null;
      for (const fr of repSequence(script.peak, { reps: 2, start: script.rest })) {
        const r = rec.update(extractFeatures(fr));
        if (r.label && r.share > 0.6) best = r.label;
      }
      expect(best, `${id} (${EXERCISES[id].id})`).toBe(id);
    });
  }
});

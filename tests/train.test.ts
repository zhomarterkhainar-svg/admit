// Trains the kNN pose classifier on the team's recordings: `npm run train`.
// Writes src/ml/extra-samples.json, which the app loads on top of the synthetic samples.
// @ts-expect-error node types are not part of the browser tsconfig
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import type { Recording } from '@/dev/recording';
import { EXERCISES, type ExerciseId } from '@/exercises/registry';
import type { Sample } from '@/ml/knn';
import { STAND } from '@/ml/dataset';
import { toVector } from '@/ml/vector';

const recordings = import.meta.glob<Recording>('./fixtures/*.json', {
  eager: true,
  import: 'default',
});

describe.skipIf(import.meta.env.MODE !== 'train')('train kNN from recordings', () => {
  it('writes src/ml/extra-samples.json', () => {
    const samples: Sample[] = [];
    const counts: Record<string, number> = {};
    for (const rec of Object.values(recordings)) {
      const def = EXERCISES[rec.exercise as ExerciseId];
      if (!def) continue;
      let taken = 0;
      rec.frames.forEach((frame, i) => {
        if (i % 3 !== 0 || taken >= 150) return;
        const f = extractFeatures(frame);
        // mid-movement frames get the exercise label, the rest is "stand"
        const label = def.progress(f) > 0.55 ? def.id : STAND;
        samples.push({ v: toVector(f).map((x) => Math.round(x * 1000) / 1000), label });
        counts[label] = (counts[label] ?? 0) + 1;
        taken++;
      });
    }
    writeFileSync('src/ml/extra-samples.json', JSON.stringify(samples) + '\n');
    console.log(
      `kNN: ${samples.length} samples from ${Object.keys(recordings).length} recordings`,
      counts,
    );
    expect(samples.length).toBeGreaterThanOrEqual(0);
  });
});

import { extractFeatures } from '@/core/features/extract';
import { blend, makePose, type PoseEdit } from '@/core/reference/template';
import { EXERCISES, EXERCISE_IDS } from '@/exercises/registry';
import type { Sample } from './knn';
import { toVector } from './vector';

export const STAND = 'stand';

/** Deterministic PRNG so the built-in model is identical on every device. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random body proportions + joint jitter so the classifier generalizes beyond the template. */
function augment(edit: PoseEdit, rand: () => number): PoseEdit {
  const out: PoseEdit = {};
  const sx = 0.85 + rand() * 0.3;
  const sy = 0.88 + rand() * 0.24;
  for (let i = 0; i < 33; i++) {
    const p = edit[i];
    if (!p) continue;
    const j = () => (rand() - 0.5) * 0.06;
    out[i] = [p[0] * sx + j(), p[1] * sy + j(), (p[2] ?? 0) + j()];
  }
  return out;
}

/**
 * Synthetic training set: for every exercise, poses from the middle to the end of the movement
 * (rest → peak blends ≥ 0.55) with augmentation; "stand" = rest poses. Deterministic.
 */
export function syntheticSamples(perClass = 70, seed = 42): Sample[] {
  const rand = mulberry32(seed);
  const samples: Sample[] = [];
  for (const id of EXERCISE_IDS) {
    const { rest, peak, peakAlt } = EXERCISES[id].keyframes;
    const peaks = peakAlt ? [peak, peakAlt] : [peak];
    for (let i = 0; i < perClass; i++) {
      const target = peaks[i % peaks.length]!;
      const k = 0.55 + rand() * 0.45;
      const f = extractFeatures(makePose(augment(blend(rest, target, k), rand)));
      samples.push({ v: toVector(f), label: id });
    }
  }
  const rests = EXERCISE_IDS.map((id) => EXERCISES[id].keyframes.rest);
  for (let i = 0; i < perClass; i++) {
    const rest = rests[i % rests.length]!;
    const f = extractFeatures(makePose(augment(rest, rand)));
    samples.push({ v: toVector(f), label: STAND });
  }
  return samples;
}

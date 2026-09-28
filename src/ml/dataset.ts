import { extractFeatures } from '@/core/features/extract';
import { STANDING_WORLD, blend, makePose, type PoseEdit } from '@/core/reference/template';
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

/** Left/right landmark pairs for mirror augmentation. */
const MIRROR: [number, number][] = [
  [1, 4],
  [2, 5],
  [3, 6],
  [7, 8],
  [9, 10],
  [11, 12],
  [13, 14],
  [15, 16],
  [17, 18],
  [19, 20],
  [21, 22],
  [23, 24],
  [25, 26],
  [27, 28],
  [29, 30],
  [31, 32],
];
const MIRROR_OF = new Map<number, number>(
  MIRROR.flatMap(
    ([a, b]) =>
      [
        [a, b],
        [b, a],
      ] as [number, number][],
  ),
);

export interface AugmentOptions {
  /** max rotation of the person relative to the camera, degrees */
  yaw: number;
  /** max camera pitch (laptop looking up/down), degrees */
  pitch: number;
  /** mirror left/right with probability 0.5 */
  mirror: boolean;
  /** joint jitter span in meters: image plane / depth (MediaPipe depth is much noisier) */
  noiseXY: number;
  noiseZ: number;
}

export const DEFAULT_AUGMENT: AugmentOptions = {
  yaw: 25,
  pitch: 10,
  mirror: true,
  noiseXY: 0.06,
  noiseZ: 0.16,
};

/**
 * Random body proportions, joint jitter, person rotation, camera pitch and mirroring,
 * so the classifier generalizes beyond the single reference body and camera.
 */
export function augment(
  edit: PoseEdit,
  rand: () => number,
  o: AugmentOptions = DEFAULT_AUGMENT,
): PoseEdit {
  const full: PoseEdit = {};
  for (let i = 0; i < 33; i++) full[i] = edit[i] ?? STANDING_WORLD[i] ?? [0, -0.6];
  const mirror = o.mirror && rand() < 0.5;
  const sx = 0.85 + rand() * 0.3;
  const sy = 0.88 + rand() * 0.24;
  const yaw = ((rand() * 2 - 1) * o.yaw * Math.PI) / 180;
  const pitch = ((rand() * 2 - 1) * o.pitch * Math.PI) / 180;
  const out: PoseEdit = {};
  for (let i = 0; i < 33; i++) {
    const src = full[mirror ? (MIRROR_OF.get(i) ?? i) : i]!;
    const j = (span: number) => (rand() - 0.5) * span;
    let x = (mirror ? -src[0] : src[0]) * sx + j(o.noiseXY);
    let y = src[1] * sy + j(o.noiseXY);
    let z = (src[2] ?? 0) + j(o.noiseZ);
    // yaw around the vertical axis, then camera pitch around x
    [x, z] = [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)];
    [y, z] = [y * Math.cos(pitch) - z * Math.sin(pitch), y * Math.sin(pitch) + z * Math.cos(pitch)];
    out[i] = [x, y, z];
  }
  return out;
}

/**
 * Synthetic training set: for every exercise, poses from the middle to the end of the movement
 * (rest → peak blends ≥ 0.55) with augmentation; "stand" = rest poses. Deterministic.
 */
export function syntheticSamples(
  perClass = 90,
  seed = 42,
  aug: AugmentOptions = DEFAULT_AUGMENT,
): Sample[] {
  const rand = mulberry32(seed);
  const samples: Sample[] = [];
  for (const id of EXERCISE_IDS) {
    const { rest, peak, peakAlt } = EXERCISES[id].keyframes;
    const peaks = peakAlt ? [peak, peakAlt] : [peak];
    for (let i = 0; i < perClass; i++) {
      const target = peaks[i % peaks.length]!;
      const k = 0.55 + rand() * 0.45;
      const f = extractFeatures(makePose(augment(blend(rest, target, k), rand, aug)));
      samples.push({ v: toVector(f), label: id });
    }
  }
  const rests = EXERCISE_IDS.map((id) => EXERCISES[id].keyframes.rest);
  for (let i = 0; i < perClass; i++) {
    const rest = rests[i % rests.length]!;
    const f = extractFeatures(makePose(augment(rest, rand, aug)));
    samples.push({ v: toVector(f), label: STAND });
  }
  return samples;
}

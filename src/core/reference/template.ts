import { P, type Landmark, type PoseFrame } from '@/core/types';

export type Pt = [number, number, number?];

/**
 * Reference standing pose, front view, ~1.75 m person. Used by tests, the ghost overlay and demo animations.
 * Synthetic standing pose, front view, ~1.75 m person.
 * World: meters, origin at hip center, y down. Image: normalized, person spans y 0.1..0.95.
 * Person's left side is at +x in world and image (camera not mirrored).
 */
export const STANDING_WORLD: Partial<Record<number, Pt>> = {
  [P.nose]: [0, -0.62],
  [P.leftEye]: [0.03, -0.65],
  [P.rightEye]: [-0.03, -0.65],
  [P.leftEar]: [0.07, -0.63],
  [P.rightEar]: [-0.07, -0.63],
  [P.leftShoulder]: [0.19, -0.5],
  [P.rightShoulder]: [-0.19, -0.5],
  [P.leftElbow]: [0.22, -0.22],
  [P.rightElbow]: [-0.22, -0.22],
  [P.leftWrist]: [0.23, 0.03],
  [P.rightWrist]: [-0.23, 0.03],
  [P.leftHip]: [0.1, 0],
  [P.rightHip]: [-0.1, 0],
  [P.leftKnee]: [0.15, 0.43],
  [P.rightKnee]: [-0.15, 0.43],
  [P.leftAnkle]: [0.18, 0.85],
  [P.rightAnkle]: [-0.18, 0.85],
  [P.leftHeel]: [0.18, 0.89, 0.03],
  [P.rightHeel]: [-0.18, 0.89, 0.03],
  [P.leftFootIndex]: [0.21, 0.9, -0.12],
  [P.rightFootIndex]: [-0.21, 0.9, -0.12],
};

export type PoseEdit = Partial<Record<number, Pt>>;

/** Build a PoseFrame from the standing template plus world-space overrides. */
export function makePose(edit: PoseEdit = {}, t = 0, width = 1280, height = 720): PoseFrame {
  const world: Landmark[] = [];
  const image: Landmark[] = [];
  // map world meters → image: scale so 1.75 m ≈ 0.85 of frame height, hip at (0.5, 0.55)
  const s = 0.85 / 1.6;
  const aspect = width / height;
  for (let i = 0; i < 33; i++) {
    const p = edit[i] ?? STANDING_WORLD[i] ?? [0, -0.6];
    const [x, y, z = 0] = p;
    world.push({ x, y, z, visibility: 0.99 });
    image.push({ x: 0.5 + (x * s) / aspect, y: 0.55 + y * s, z, visibility: 0.99 });
  }
  return { t, world, image, width, height };
}

/** Linear blend between two pose edits (k=0 → a, k=1 → b). Missing points use the standing template. */
export function blend(a: PoseEdit, b: PoseEdit, k: number): PoseEdit {
  const out: PoseEdit = {};
  for (let i = 0; i < 33; i++) {
    const pa = a[i] ?? STANDING_WORLD[i] ?? [0, -0.6];
    const pb = b[i] ?? STANDING_WORLD[i] ?? [0, -0.6];
    out[i] = [0, 1, 2].map((j) => (pa[j] ?? 0) * (1 - k) + (pb[j] ?? 0) * k) as Pt;
  }
  return out;
}

/**
 * Generates frames for `reps` repetitions going standing → target → standing.
 * @param msPerRep full rep duration
 */
export function repSequence(
  target: PoseEdit,
  { reps = 1, msPerRep = 2000, fps = 30, holdMs = 400, start: startEdit = {} as PoseEdit } = {},
): PoseFrame[] {
  const frames: PoseFrame[] = [];
  const dt = 1000 / fps;
  let t = 0;
  const push = (k: number) => {
    frames.push(makePose(blend(startEdit, target, k), t));
    t += dt;
  };
  for (let i = 0; i < holdMs / dt; i++) push(0);
  for (let r = 0; r < reps; r++) {
    const n = Math.round(msPerRep / dt);
    for (let i = 0; i <= n; i++) push(Math.sin((Math.PI * i) / n));
    for (let i = 0; i < holdMs / dt; i++) push(0);
  }
  return frames;
}

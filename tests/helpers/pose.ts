import { P, type Landmark, type PoseFrame } from '@/core/types';

type Pt = [number, number, number?];

/**
 * Synthetic standing pose, front view, ~1.75 m person.
 * World: meters, origin at hip center, y down. Image: normalized, person spans y 0.1..0.95.
 * Person's left side is at +x in world and image (camera not mirrored).
 */
const STANDING_WORLD: Partial<Record<number, Pt>> = {
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
  [P.leftKnee]: [0.11, 0.43],
  [P.rightKnee]: [-0.11, 0.43],
  [P.leftAnkle]: [0.12, 0.85],
  [P.rightAnkle]: [-0.12, 0.85],
  [P.leftHeel]: [0.12, 0.89, 0.03],
  [P.rightHeel]: [-0.12, 0.89, 0.03],
  [P.leftFootIndex]: [0.14, 0.9, -0.12],
  [P.rightFootIndex]: [-0.14, 0.9, -0.12],
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

/** Deep squat: hips drop and move back, knees forward. */
export function squatDown(extra: PoseEdit = {}): PoseEdit {
  return {
    [P.leftShoulder]: [0.19, -0.1, -0.25],
    [P.rightShoulder]: [-0.19, -0.1, -0.25],
    [P.leftElbow]: [0.22, 0.1, -0.35],
    [P.rightElbow]: [-0.22, 0.1, -0.35],
    [P.leftWrist]: [0.2, 0.1, -0.6],
    [P.rightWrist]: [-0.2, 0.1, -0.6],
    [P.leftHip]: [0.1, 0.4, 0.2],
    [P.rightHip]: [-0.1, 0.4, 0.2],
    [P.leftKnee]: [0.16, 0.45, -0.22],
    [P.rightKnee]: [-0.16, 0.45, -0.22],
    ...extra,
  };
}

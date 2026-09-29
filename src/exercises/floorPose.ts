import { P, type FrameFeatures } from '@/core/types';
import type { PoseEdit, Pt } from '@/core/reference/template';
import { floorView } from '@/engine/setupRules';

/**
 * Side-view poses for floor exercises. The person lies along the world x axis with the head
 * toward −x, the camera looking at their left side. Points are given in the sagittal plane
 * (x along the body, y down) relative to the floor (y = 0) and shifted so the hip center is the
 * origin, like MediaPipe world landmarks. Left joints are nearer the camera (−z).
 */
export type Side2 = [number, number];

export interface Sagittal {
  nose: Side2;
  ear: Side2;
  shoulder: Side2;
  elbow: Side2;
  wrist: Side2;
  hip: Side2;
  knee: Side2;
  ankle: Side2;
  heel: Side2;
  toe: Side2;
}

/** half-width of each joint pair across the body (m) */
const HALF = {
  eye: 0.03,
  ear: 0.07,
  shoulder: 0.19,
  elbow: 0.22,
  wrist: 0.24,
  hip: 0.1,
  knee: 0.1,
  ankle: 0.1,
  foot: 0.11,
};

export function lying(s: Sagittal): PoseEdit {
  const [hx, hy] = s.hip;
  const at = ([x, y]: Side2, z = 0): Pt => [x - hx, y - hy, z];
  const pair = (l: number, r: number, p: Side2, half: number): PoseEdit => ({
    [l]: at(p, -half),
    [r]: at(p, half),
  });
  return {
    [P.nose]: at(s.nose),
    ...pair(P.leftEye, P.rightEye, [s.nose[0] + 0.03, s.nose[1] - 0.02], HALF.eye),
    ...pair(P.leftEar, P.rightEar, s.ear, HALF.ear),
    ...pair(P.leftShoulder, P.rightShoulder, s.shoulder, HALF.shoulder),
    ...pair(P.leftElbow, P.rightElbow, s.elbow, HALF.elbow),
    ...pair(P.leftWrist, P.rightWrist, s.wrist, HALF.wrist),
    ...pair(P.leftIndex, P.rightIndex, [s.wrist[0] - 0.08, s.wrist[1]], HALF.wrist),
    ...pair(P.leftHip, P.rightHip, s.hip, HALF.hip),
    ...pair(P.leftKnee, P.rightKnee, s.knee, HALF.knee),
    ...pair(P.leftAnkle, P.rightAnkle, s.ankle, HALF.ankle),
    ...pair(P.leftHeel, P.rightHeel, s.heel, HALF.foot),
    ...pair(P.leftFootIndex, P.rightFootIndex, s.toe, HALF.foot),
  };
}

/** Straight body from the shoulder to the ankle, with the hip `sag` metres below that line. */
export function bodyLine(shoulder: Side2, ankle: Side2, sag = 0): { hip: Side2; knee: Side2 } {
  const along = (k: number): Side2 => [
    shoulder[0] + (ankle[0] - shoulder[0]) * k,
    shoulder[1] + (ankle[1] - shoulder[1]) * k,
  ];
  const [hx, hy] = along(0.37);
  const [kx, ky] = along(0.68);
  return { hip: [hx, hy + sag], knee: [kx, ky + sag * 0.5] };
}

/** Joint angles of the side facing the camera: the far side is hidden and badly estimated. */
export function nearSide(f: FrameFeatures): 'l' | 'r' {
  const v = f.jointVisibility;
  const score = (ids: number[]) => ids.reduce((s, i) => s + (v[i] ?? 0), 0);
  return score([P.leftShoulder, P.leftElbow, P.leftWrist, P.leftHip, P.leftKnee]) >=
    score([P.rightShoulder, P.rightElbow, P.rightWrist, P.rightHip, P.rightKnee])
    ? 'l'
    : 'r';
}

export { floorView } from '@/engine/setupRules';

/** From the side only the near arm is trustworthy; from the front both are: average them. */
const arm = (f: FrameFeatures, v: FrameFeatures['elbowAngle']) =>
  floorView(f) === 'front' ? (v.l + v.r) / 2 : v[nearSide(f)];

export const elbow = (f: FrameFeatures) => arm(f, f.elbowAngle);
/**
 * Elbow flare: the angle between the upper arm and the torso (3D). Near the bottom of a push-up
 * ~45° is right ("an arrow"), ~90° is elbows flared out ("a T") — hard on the shoulders.
 */
export const flare = (f: FrameFeatures) => arm(f, f.shoulderAngle);
export const knee = (f: FrameFeatures) => f.kneeAngle[nearSide(f)];
export const hip = (f: FrameFeatures) => f.hipAngle[nearSide(f)];

/**
 * A side-view floor pose turned to face the camera, head toward it: the body's long axis becomes
 * depth, the player's left goes to image +x. For reference poses and tests of the front view.
 */
export function facingCamera(edit: PoseEdit): PoseEdit {
  const out: PoseEdit = {};
  for (const [k, p] of Object.entries(edit)) {
    const [x, y, z = 0] = p!;
    out[Number(k)] = [-z, y, x];
  }
  return out;
}

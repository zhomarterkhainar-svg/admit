import { P, type FrameFeatures, type PoseFrame } from '@/core/types';
import type { PoseEdit } from '@/core/reference/template';
import type { I18nKey } from '@/i18n';
import { pressTop } from '@/exercises/press/reference';
import { sideBend } from '@/exercises/sideBend/reference';
import { squatDown } from '@/exercises/squat/reference';

export type MoveId =
  | 'reins'
  | 'up'
  | 'wings'
  | 'leanL'
  | 'leanR'
  | 'clap'
  | 'kneeL'
  | 'kneeR'
  | 'squat';

export interface DanceMove {
  id: MoveId;
  name: I18nKey;
  /** reference pose (world space): the icon, the demo dancer and the tests */
  pose: PoseEdit;
  /** is the dancer in this pose right now? */
  match(f: FrameFeatures, frame: PoseFrame): boolean;
}

const both = (v: { l: number; r: number }, lo: number, hi: number) =>
  v.l >= lo && v.l <= hi && v.r >= lo && v.r <= hi;
const meanKnee = (f: FrameFeatures) => (f.kneeAngle.l + f.kneeAngle.r) / 2;
/** standing tall (not squatting): the arm moves are danced on straight legs */
const standing = (f: FrameFeatures) => meanKnee(f) > 145;

/** wrist-to-wrist distance in shoulder widths (aspect-corrected image) */
function handsApart(f: FrameFeatures, frame: PoseFrame): number {
  const a = frame.width / frame.height;
  const l = frame.image[P.leftWrist]!;
  const r = frame.image[P.rightWrist]!;
  return Math.hypot((l.x - r.x) * a, l.y - r.y) / Math.max(f.shoulderWidth, 1e-3);
}

/**
 * The moves of Qara Zhorga ("black pacer"), a Kazakh folk dance: the reins (the signature
 * move — hands before the chest as if holding a horse's reins), arms up, wings, leaning left /
 * right, a clap, knee raises and a squat. Each reference pose passes only its own matcher.
 */
export const MOVES: Record<MoveId, DanceMove> = {
  reins: {
    id: 'reins',
    name: 'dance.move.reins',
    pose: {
      [P.leftElbow]: [0.21, -0.3, -0.22],
      [P.rightElbow]: [-0.21, -0.3, -0.22],
      [P.leftWrist]: [0.17, -0.42, -0.42],
      [P.rightWrist]: [-0.17, -0.42, -0.42],
      [P.leftIndex]: [0.15, -0.44, -0.47],
      [P.rightIndex]: [-0.15, -0.44, -0.47],
    },
    match: (f, frame) =>
      standing(f) &&
      both(f.wristLift, -0.8, -0.1) &&
      both(f.elbowAngle, 50, 130) &&
      handsApart(f, frame) >= 0.6,
  },
  up: {
    id: 'up',
    name: 'dance.move.up',
    pose: pressTop(),
    match: (f) =>
      f.wristAboveHead.l && f.wristAboveHead.r && f.elbowAngle.l > 130 && f.elbowAngle.r > 130,
  },
  wings: {
    id: 'wings',
    name: 'dance.move.wings',
    pose: {
      [P.leftElbow]: [0.46, -0.5],
      [P.rightElbow]: [-0.46, -0.5],
      [P.leftWrist]: [0.72, -0.52],
      [P.rightWrist]: [-0.72, -0.52],
      [P.leftIndex]: [0.8, -0.52],
      [P.rightIndex]: [-0.8, -0.52],
    },
    match: (f) => both(f.shoulderAngle, 65, 120) && f.elbowAngle.l > 140 && f.elbowAngle.r > 140,
  },
  leanL: {
    id: 'leanL',
    name: 'dance.move.leanL',
    pose: sideBend('l'),
    match: (f) => f.torsoSideLean < -12,
  },
  leanR: {
    id: 'leanR',
    name: 'dance.move.leanR',
    pose: sideBend('r'),
    match: (f) => f.torsoSideLean > 12,
  },
  clap: {
    id: 'clap',
    name: 'dance.move.clap',
    pose: {
      [P.leftElbow]: [0.22, -0.3, -0.2],
      [P.rightElbow]: [-0.22, -0.3, -0.2],
      [P.leftWrist]: [0.03, -0.5, -0.4],
      [P.rightWrist]: [-0.03, -0.5, -0.4],
      [P.leftIndex]: [0.02, -0.58, -0.42],
      [P.rightIndex]: [-0.02, -0.58, -0.42],
    },
    // hands together at chest or face height (not overhead, not down at the belly)
    match: (f, frame) =>
      handsApart(f, frame) < 0.6 &&
      both(f.wristLift, -0.8, 0.6) &&
      !f.wristAboveHead.l &&
      !f.wristAboveHead.r,
  },
  kneeL: {
    id: 'kneeL',
    name: 'dance.move.kneeL',
    pose: {
      [P.leftKnee]: [0.14, -0.05, -0.38],
      [P.leftAnkle]: [0.15, 0.36, -0.36],
      [P.leftHeel]: [0.15, 0.4, -0.33],
      [P.leftFootIndex]: [0.17, 0.4, -0.48],
    },
    match: (f) => f.kneeDrop.l < 0.45 && f.kneeDrop.r > 0.6,
  },
  kneeR: {
    id: 'kneeR',
    name: 'dance.move.kneeR',
    pose: {
      [P.rightKnee]: [-0.14, -0.05, -0.38],
      [P.rightAnkle]: [-0.15, 0.36, -0.36],
      [P.rightHeel]: [-0.15, 0.4, -0.33],
      [P.rightFootIndex]: [-0.17, 0.4, -0.48],
    },
    match: (f) => f.kneeDrop.r < 0.45 && f.kneeDrop.l > 0.6,
  },
  squat: {
    id: 'squat',
    name: 'dance.move.squat',
    pose: squatDown(),
    match: (f) => meanKnee(f) < 125,
  },
};

export const MOVE_IDS = Object.keys(MOVES) as MoveId[];

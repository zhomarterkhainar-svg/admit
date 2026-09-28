import { P } from '@/core/types';
import { blend, type PoseEdit } from '@/core/reference/template';
import { squatDown } from './squat/reference';
import { jackOpen } from './jumpingJack/reference';
import { lungeDown } from './lunge/reference';
import { pressTop } from './press/reference';
import { sideBend } from './sideBend/reference';

export interface ErrorExample {
  wrong: PoseEdit;
  right: PoseEdit;
}

/**
 * Visual "wrong vs right" pairs for the most common mistakes (same poses the demo actor uses,
 * so every example is verified by tests to actually trigger its rule).
 */
export const ERROR_EXAMPLES: Record<string, ErrorExample> = {
  'squat.depth': { wrong: blend({}, squatDown(), 0.55), right: squatDown() },
  'squat.valgus': {
    wrong: squatDown({ [P.leftKnee]: [0.05, 0.45, -0.22], [P.rightKnee]: [-0.05, 0.45, -0.22] }),
    right: squatDown(),
  },
  'jumpingJack.armsLow': {
    wrong: jackOpen({
      [P.leftElbow]: [0.4, -0.45],
      [P.rightElbow]: [-0.4, -0.45],
      [P.leftWrist]: [0.55, -0.55],
      [P.rightWrist]: [-0.55, -0.55],
    }),
    right: jackOpen(),
  },
  'jumpingJack.narrow': {
    wrong: jackOpen({
      [P.leftAnkle]: [0.25, 0.84],
      [P.rightAnkle]: [-0.25, 0.84],
      [P.leftHeel]: [0.25, 0.88],
      [P.rightHeel]: [-0.25, 0.88],
    }),
    right: jackOpen(),
  },
  'lunge.depth': { wrong: blend({}, lungeDown('l'), 0.6), right: lungeDown('l') },
  'lunge.torso': {
    wrong: lungeDown('l', {
      [P.leftShoulder]: [0.19, -0.2, -0.3],
      [P.rightShoulder]: [-0.19, -0.2, -0.3],
      [P.nose]: [0, -0.3, -0.4],
    }),
    right: lungeDown('l'),
  },
  'press.lockout': {
    wrong: pressTop({
      [P.leftElbow]: [0.36, -0.75],
      [P.rightElbow]: [-0.36, -0.75],
      [P.leftWrist]: [0.22, -1.0],
      [P.rightWrist]: [-0.22, -1.0],
    }),
    right: pressTop(),
  },
  'press.asym': {
    wrong: pressTop({ [P.rightElbow]: [-0.36, -0.42], [P.rightWrist]: [-0.32, -0.62] }),
    right: pressTop(),
  },
  'sideBend.depth': { wrong: blend({}, sideBend('l'), 0.7), right: sideBend('l') },
};

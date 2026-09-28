import { P } from '@/core/types';
import type { PoseEdit } from '@/core/reference/template';
import type { Side } from '@/engine/types';

/** Bottom of a forward lunge seen from the front. `side` = front leg. */
export function lungeDown(side: Side = 'l', extra: PoseEdit = {}): PoseEdit {
  const front: PoseEdit = {
    [P.leftKnee]: [0.15, 0.37, -0.45],
    [P.leftAnkle]: [0.17, 0.8, -0.5],
    [P.leftHeel]: [0.17, 0.85, -0.45],
    [P.leftFootIndex]: [0.19, 0.87, -0.62],
    [P.rightKnee]: [-0.15, 0.8, 0.2],
    [P.rightAnkle]: [-0.17, 0.72, 0.6],
    [P.rightHeel]: [-0.17, 0.68, 0.62],
    [P.rightFootIndex]: [-0.19, 0.86, 0.5],
  };
  const mirrored: PoseEdit = {};
  const swap: Record<number, number> = {
    [P.leftKnee]: P.rightKnee,
    [P.leftAnkle]: P.rightAnkle,
    [P.leftHeel]: P.rightHeel,
    [P.leftFootIndex]: P.rightFootIndex,
    [P.rightKnee]: P.leftKnee,
    [P.rightAnkle]: P.leftAnkle,
    [P.rightHeel]: P.leftHeel,
    [P.rightFootIndex]: P.leftFootIndex,
  };
  for (const [k, v] of Object.entries(front)) {
    const [x, y, z] = v!;
    mirrored[swap[Number(k)]!] = [-x, y, z];
  }
  return {
    [P.nose]: [0, -0.27],
    [P.leftEye]: [0.03, -0.3],
    [P.rightEye]: [-0.03, -0.3],
    [P.leftEar]: [0.07, -0.28],
    [P.rightEar]: [-0.07, -0.28],
    [P.leftShoulder]: [0.19, -0.15],
    [P.rightShoulder]: [-0.19, -0.15],
    [P.leftElbow]: [0.22, 0.12],
    [P.rightElbow]: [-0.22, 0.12],
    [P.leftWrist]: [0.23, 0.35],
    [P.rightWrist]: [-0.23, 0.35],
    [P.leftHip]: [0.1, 0.35],
    [P.rightHip]: [-0.1, 0.35],
    ...(side === 'l' ? front : mirrored),
    ...extra,
  };
}

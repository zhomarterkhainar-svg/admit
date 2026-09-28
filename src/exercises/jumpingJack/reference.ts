import { P } from '@/core/types';
import type { PoseEdit } from '@/core/reference/template';

/** Open position: arms up in a V above the head, feet wide. */
export function jackOpen(extra: PoseEdit = {}): PoseEdit {
  return {
    [P.leftElbow]: [0.33, -0.8],
    [P.rightElbow]: [-0.33, -0.8],
    [P.leftWrist]: [0.35, -1.06],
    [P.rightWrist]: [-0.35, -1.06],
    [P.leftKnee]: [0.28, 0.42],
    [P.rightKnee]: [-0.28, 0.42],
    [P.leftAnkle]: [0.42, 0.83],
    [P.rightAnkle]: [-0.42, 0.83],
    [P.leftHeel]: [0.42, 0.87, 0.03],
    [P.rightHeel]: [-0.42, 0.87, 0.03],
    [P.leftFootIndex]: [0.46, 0.88, -0.12],
    [P.rightFootIndex]: [-0.46, 0.88, -0.12],
    ...extra,
  };
}

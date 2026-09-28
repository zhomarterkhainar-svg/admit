import { P } from '@/core/types';
import type { PoseEdit } from '@/core/reference/template';

/** Deep squat: hips drop and move back, knees forward. */
export function squatDown(extra: PoseEdit = {}): PoseEdit {
  return {
    [P.nose]: [0, -0.22, -0.35],
    [P.leftEye]: [0.03, -0.25, -0.33],
    [P.rightEye]: [-0.03, -0.25, -0.33],
    [P.leftEar]: [0.07, -0.23, -0.28],
    [P.rightEar]: [-0.07, -0.23, -0.28],
    [P.leftShoulder]: [0.19, -0.1, -0.25],
    [P.rightShoulder]: [-0.19, -0.1, -0.25],
    [P.leftElbow]: [0.22, 0.1, -0.35],
    [P.rightElbow]: [-0.22, 0.1, -0.35],
    [P.leftWrist]: [0.2, 0.1, -0.6],
    [P.rightWrist]: [-0.2, 0.1, -0.6],
    [P.leftHip]: [0.1, 0.4, 0.2],
    [P.rightHip]: [-0.1, 0.4, 0.2],
    [P.leftKnee]: [0.21, 0.45, -0.22],
    [P.rightKnee]: [-0.21, 0.45, -0.22],
    ...extra,
  };
}

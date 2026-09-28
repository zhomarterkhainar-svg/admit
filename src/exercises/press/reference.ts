import { P } from '@/core/types';
import type { PoseEdit } from '@/core/reference/template';

/** "Raise the shield" start: hands just above the shoulders, elbows out. */
export function pressStart(extra: PoseEdit = {}): PoseEdit {
  return {
    [P.leftElbow]: [0.36, -0.4],
    [P.rightElbow]: [-0.36, -0.4],
    [P.leftWrist]: [0.32, -0.58],
    [P.rightWrist]: [-0.32, -0.58],
    ...extra,
  };
}

/** Lockout: arms straight overhead. */
export function pressTop(extra: PoseEdit = {}): PoseEdit {
  return {
    [P.leftElbow]: [0.22, -0.82],
    [P.rightElbow]: [-0.22, -0.82],
    [P.leftWrist]: [0.22, -1.1],
    [P.rightWrist]: [-0.22, -1.1],
    ...extra,
  };
}

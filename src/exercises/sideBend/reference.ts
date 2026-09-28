import { P } from '@/core/types';
import type { PoseEdit } from '@/core/reference/template';
import type { Side } from '@/engine/types';

/** Side bend toward `side` (user's left = +x in world/image), opposite arm reaching overhead. */
export function sideBend(side: Side = 'l', extra: PoseEdit = {}): PoseEdit {
  const left: PoseEdit = {
    [P.nose]: [0.33, -0.55],
    [P.leftEye]: [0.35, -0.58],
    [P.rightEye]: [0.29, -0.59],
    [P.leftEar]: [0.39, -0.54],
    [P.rightEar]: [0.25, -0.58],
    [P.leftShoulder]: [0.36, -0.3],
    [P.rightShoulder]: [0.02, -0.52],
    [P.leftElbow]: [0.46, -0.05],
    [P.rightElbow]: [0.02, -0.82],
    [P.leftWrist]: [0.48, 0.2],
    [P.rightWrist]: [0.22, -1.02],
  };
  if (side === 'l') return { ...left, ...extra };
  const swap: Record<number, number> = {
    [P.leftEye]: P.rightEye,
    [P.rightEye]: P.leftEye,
    [P.leftEar]: P.rightEar,
    [P.rightEar]: P.leftEar,
    [P.leftShoulder]: P.rightShoulder,
    [P.rightShoulder]: P.leftShoulder,
    [P.leftElbow]: P.rightElbow,
    [P.rightElbow]: P.leftElbow,
    [P.leftWrist]: P.rightWrist,
    [P.rightWrist]: P.leftWrist,
  };
  const right: PoseEdit = {};
  for (const [k, v] of Object.entries(left)) {
    const [x, y, z] = v!;
    right[swap[Number(k)] ?? Number(k)] = [-x, y, z];
  }
  return { ...right, ...extra };
}

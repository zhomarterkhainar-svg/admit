import { P } from '@/core/types';
import type { PoseEdit } from '@/core/reference/template';
import { bodyLine, lying, type Side2 } from '../floorPose';

const WRIST: Side2 = [-0.42, -0.03];
const ANKLE: Side2 = [0.85, -0.1];

function pose(shoulder: Side2, elbow: Side2, sag = 0) {
  const { hip, knee } = bodyLine(shoulder, ANKLE, sag);
  const dx = shoulder[0] - ANKLE[0];
  const dy = shoulder[1] - ANKLE[1];
  const len = Math.hypot(dx, dy);
  const along = (k: number, drop = 0): Side2 => [
    shoulder[0] + (dx / len) * k,
    shoulder[1] + (dy / len) * k + drop,
  ];
  return lying({
    nose: along(0.21, 0.05),
    ear: along(0.13),
    shoulder,
    elbow,
    wrist: WRIST,
    hip,
    knee,
    ankle: ANKLE,
    heel: [ANKLE[0] + 0.05, ANKLE[1] - 0.04],
    toe: [ANKLE[0] + 0.12, -0.01],
  });
}

/** Top of a push-up: arms straight, body one straight line from the head to the heels. */
export const pushupTop = (sag = 0) => pose([-0.45, -0.58], [-0.435, -0.305], sag);

/** Bottom: chest near the floor, elbows bent to ~60° and pointing back. */
export const pushupDown = (sag = 0) => pose([-0.62, -0.2], [-0.355, -0.293], sag);

/**
 * The common mistake: the same bottom position with the elbows flared straight out to the sides
 * (a "T" from above, ~90° to the body) and the hands placed wide under them.
 */
export function pushupDownFlared(): PoseEdit {
  const d = pushupDown();
  const sx = d[P.leftShoulder]![0];
  const wristY = d[P.leftWrist]![1];
  return {
    ...d,
    [P.leftElbow]: [sx + 0.02, wristY - 0.25, -0.46],
    [P.rightElbow]: [sx + 0.02, wristY - 0.25, 0.46],
    [P.leftWrist]: [sx + 0.02, wristY, -0.46],
    [P.rightWrist]: [sx + 0.02, wristY, 0.46],
    [P.leftIndex]: [sx - 0.06, wristY, -0.46],
    [P.rightIndex]: [sx - 0.06, wristY, 0.46],
  };
}

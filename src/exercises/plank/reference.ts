import { bodyLine, lying, type Side2 } from '../floorPose';

const SHOULDER: Side2 = [-0.5, -0.33];
const ANKLE: Side2 = [0.85, -0.1];

/** Forearm plank; `sag` > 0 drops the hips (m), < 0 pikes them up. */
export function plankPose(sag = 0) {
  const { hip, knee } = bodyLine(SHOULDER, ANKLE, sag);
  return lying({
    nose: [-0.71, -0.33],
    ear: [-0.63, -0.37],
    shoulder: SHOULDER,
    elbow: [-0.5, -0.05],
    wrist: [-0.76, -0.04],
    hip,
    knee,
    ankle: ANKLE,
    heel: [0.9, -0.14],
    toe: [0.97, -0.01],
  });
}

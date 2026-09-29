import { lying, type Side2 } from '../floorPose';

const SHOULDER: Side2 = [-0.5, -0.08];
const ANKLE: Side2 = [0.49, -0.08];

function pose(hip: Side2, knee: Side2, ankle: Side2 = ANKLE) {
  return lying({
    nose: [-0.7, -0.17],
    ear: [-0.66, -0.09],
    shoulder: SHOULDER,
    elbow: [-0.28, -0.04],
    wrist: [-0.03, -0.04],
    hip,
    knee,
    ankle,
    heel: [ankle[0] + 0.02, -0.03],
    toe: [ankle[0] + 0.16, -0.02],
  });
}

/** Lying on the back, knees bent, feet flat, hips on the floor. */
export const bridgeDown = () => pose([0, -0.08], [0.254, -0.427]);

/** Hips lifted: knees, hips and shoulders in one straight line. */
export const bridgeUp = () => pose([-0.047, -0.291], [0.343, -0.473]);

/** Feet placed too far away: the legs straighten and the hamstrings do the work. */
export const bridgeUpFar = () => pose([-0.047, -0.291], [0.343, -0.473], [0.72, -0.08]);

/** Thresholds for the glute bridge (lying on the back, side view). Angles in degrees. */
export const BRIDGE = {
  /** hip angle (shoulder–hip–knee) above this → hips "up" */
  upEnter: 148,
  /** below this → back "down" */
  downEnter: 138,
  /** the top of a rep must reach at least this hip angle (a straight line knees–shoulders) */
  heightMin: 165,
  /** knee angle at the top above this → feet too far from the hips */
  kneeMax: 100,
  /** hold the top at least this long (ms) */
  minTopMs: 200,
} as const;

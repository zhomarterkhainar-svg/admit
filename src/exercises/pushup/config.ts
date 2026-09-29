/** Thresholds for push-ups (side view). Tune with the /dev HUD and recorded fixtures. */
export const PUSHUP = {
  /** elbow angle below this → going "down" */
  downEnter: 125,
  /** elbow angle above this → back "up" */
  upEnter: 150,
  /** the lowest elbow angle of a rep must be ≤ this, otherwise it is too shallow */
  depthMax: 100,
  /** hips below the shoulder–ankle line, in body lengths */
  sagMax: 0.07,
  /** hips above the line (piked), in body lengths */
  pikeMax: 0.09,
  /** knee angle below this → knees bent / on the floor */
  kneeMin: 145,
  /** lowering faster than this (ms) is dropping, not a push-up */
  minDescentMs: 200,
} as const;

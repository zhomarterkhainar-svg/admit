/** Thresholds for push-ups (side or front view). Tune with the /dev HUD and recorded fixtures. */
export const PUSHUP = {
  /** elbow angle below this → going "down" */
  downEnter: 125,
  /** elbow angle above this → back "up" */
  upEnter: 150,
  /** the lowest elbow angle of a rep must be ≤ this, otherwise it is too shallow */
  depthMax: 100,
  /** hips below the shoulder–ankle line, in body lengths (side view, image) */
  sagMax: 0.07,
  /** hips above the line (piked), in body lengths (side view, image) */
  pikeMax: 0.09,
  /** the same from the front, off the shoulder–knee line in world space (hipLineOffsetW) */
  sagMaxW: 0.075,
  pikeMaxW: 0.09,
  /** knee angle below this → knees bent / on the floor */
  kneeMin: 145,
  /** lowering faster than this (ms) is dropping, not a push-up */
  minDescentMs: 200,
  /** elbow flare is judged once the elbows are bent below this (at the top it means nothing) */
  flareBelowElbow: 120,
  /** upper arm to torso above this near the bottom = elbows flared out (~45° is right) */
  flareMax: 70,
} as const;

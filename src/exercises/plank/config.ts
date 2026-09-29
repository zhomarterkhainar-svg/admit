/** Thresholds for the plank (side view). Offsets are in body lengths off the shoulder–ankle line. */
export const PLANK = {
  /** enter the hold when the body is at least this straight */
  holdEnter: 0.09,
  /** leave the hold (timer stops) beyond this */
  holdExit: 0.13,
  /** hips sagging toward the floor */
  sagMax: 0.05,
  /** hips piked up */
  pikeMax: 0.06,
  /** straight legs: knee angle above this (below it the knees are on the floor) */
  kneeMin: 145,
  /** body line flatter than this (degrees from horizontal) */
  tiltMax: 40,
} as const;

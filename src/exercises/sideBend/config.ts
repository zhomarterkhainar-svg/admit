export const BEND = {
  /** |side lean| to enter a bend */
  enter: 15,
  /** |side lean| to count as back in the center */
  center: 7,
  /** each bend must reach at least this */
  depthMin: 20,
  /** leaning toward the camera instead of sideways */
  pitchMax: 20,
  /** hips drifting sideways, shoulder widths */
  hipShiftMax: 0.35,
  /** knees must stay straight */
  kneeMin: 155,
} as const;

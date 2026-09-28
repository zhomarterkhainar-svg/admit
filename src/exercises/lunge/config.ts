export const LUNGE = {
  /** avg knee angle to enter "down" */
  downEnter: 140,
  /** avg knee angle to return "up" */
  upEnter: 160,
  /** front knee must reach ≤ this */
  frontKneeMax: 110,
  /** back knee must reach ≤ this */
  backKneeMax: 125,
  /** torso lean from vertical */
  torsoMax: 25,
  /** sideways wobble */
  sideLeanMax: 12,
  /** front knee drifting inward, shoulder widths */
  kneeInwardMax: 0.25,
} as const;

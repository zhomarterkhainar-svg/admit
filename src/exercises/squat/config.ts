/** Thresholds for squat detection. Tune with the /dev HUD and recorded fixtures. */
export const SQUAT = {
  /** avg knee angle below this → entering "down" */
  downEnter: 145,
  /** avg knee angle above this → back "up" */
  upEnter: 162,
  /** min knee angle during rep must be ≤ this, otherwise rep is too shallow */
  depthMax: 100,
  /** knee distance / ankle distance below this at the bottom → valgus */
  valgusRatio: 0.8,
  /** torso lean from vertical, degrees */
  torsoLeanMax: 50,
  /** |left − right| knee angle, degrees */
  asymMax: 18,
  /** ankle distance / shoulder width */
  stanceMin: 0.7,
  /** descent faster than this (ms) is too fast */
  minDescentMs: 450,
} as const;

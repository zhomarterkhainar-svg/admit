export const JACK = {
  /** avg shoulder angle (0 = arms down, 180 = straight up) to enter "open" */
  openEnter: 80,
  /** … and to return to "closed" */
  closedEnter: 45,
  /** ankle distance / shoulder width at the widest point */
  stanceGood: 1.5,
  /** below this legs basically did not move → arms and legs out of sync */
  stanceMoved: 1.2,
  /** elbow angle when arms are up */
  elbowMin: 140,
} as const;

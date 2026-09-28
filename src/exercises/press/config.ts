export const PRESS = {
  /** avg wrist lift (torso lengths above shoulders) to enter "up" */
  upEnter: 0.9,
  /** … to return "down" */
  downEnter: 0.5,
  /** elbows must straighten to at least this at the top */
  lockoutMin: 155,
  /** |left − right| wrist lift */
  asymMax: 0.35,
  /** arching back while pressing, degrees of negative torso pitch */
  archMax: 12,
  /** bottom of the rep must come down to ≤ this wrist lift (full range) */
  bottomMax: 0.3,
} as const;

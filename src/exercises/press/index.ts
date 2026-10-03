import { P, type FrameFeatures } from '@/core/types';
import type { ExerciseDefinition } from '@/engine/types';
import { PRESS as C } from './config';
import { pressStart, pressTop } from './reference';

export interface PressMetrics {
  /** best (max) of the weaker elbow's angle while arms are up */
  lockout: number;
  /** lowest wrist lift during the rep, including the descent back */
  minLift: number;
  maxLift: number;
}

/** The higher hand drives the phase, so a lagging arm is still recognized as a (bad) rep. */
const lift = (f: FrameFeatures) => Math.max(f.wristLift.l, f.wristLift.r);

export const press: ExerciseDefinition<PressMetrics> = {
  id: 'press',
  name: 'press.name',
  howTo: 'press.howTo',
  view: 'front',
  needs: ['upper'],
  phases: ['down', 'up'],
  initialPhase: 'down',
  repStart: 'down',
  keyframes: { rest: pressStart(), peak: pressTop() },

  nextPhase(f, current) {
    const l = lift(f);
    if (current === 'down') return l > C.upEnter ? 'up' : 'down';
    return l < C.downEnter ? 'down' : 'up';
  },

  progress: (f) => (lift(f) - 0.2) / (1.2 - 0.2),

  peakAngle: (m) => m.lockout,
  angleLabel: 'moves.angle.lockout',

  initMetrics: (f) => ({ lockout: 0, minLift: lift(f), maxLift: lift(f) }),

  track: (m, f) => ({
    lockout:
      lift(f) > C.upEnter
        ? Math.max(m.lockout, Math.min(f.elbowAngle.l, f.elbowAngle.r))
        : m.lockout,
    minLift: Math.min(m.minLift, lift(f)),
    maxLift: Math.max(m.maxLift, lift(f)),
  }),

  frameRules: [
    {
      kind: 'frame',
      id: 'press.asym',
      severity: 'form',
      message: 'press.asym.msg',
      fix: 'press.asym.fix',
      joints: [P.leftWrist, P.rightWrist, P.leftElbow, P.rightElbow],
      persistMs: 250,
      test: (f) => lift(f) > 0.4 && Math.abs(f.wristLift.l - f.wristLift.r) > C.asymMax,
    },
    {
      kind: 'frame',
      id: 'press.arch',
      severity: 'safety',
      message: 'press.arch.msg',
      fix: 'press.arch.fix',
      phases: ['up'],
      joints: [P.leftHip, P.rightHip, P.leftShoulder, P.rightShoulder],
      persistMs: 300,
      test: (f) => f.torsoPitch < -C.archMax,
    },
  ],

  repRules: [
    {
      kind: 'rep',
      id: 'press.lockout',
      severity: 'validity',
      message: 'press.lockout.msg',
      fix: 'press.lockout.fix',
      joints: [P.leftElbow, P.rightElbow],
      arrows: [
        { joint: P.leftWrist, dir: [0, -1] },
        { joint: P.rightWrist, dir: [0, -1] },
      ],
      invalidates: true,
      test: (m) => m.lockout < C.lockoutMin,
    },
  ],
};

import { P } from '@/core/types';
import type { ExerciseDefinition } from '@/engine/types';
import { BEND as C } from './config';
import { sideBend as bendPose } from './reference';

export interface BendMetrics {
  /** signed lean with the largest magnitude (− = user's left) */
  peak: number;
  hipX0: number;
  maxHipShift: number;
}

export const sideBend: ExerciseDefinition<BendMetrics> = {
  id: 'sideBend',
  name: 'sideBend.name',
  howTo: 'sideBend.howTo',
  view: 'front',
  needs: ['upper', 'lower'],
  phases: ['center', 'left', 'right'],
  initialPhase: 'center',
  repStart: 'center',
  keyframes: { rest: {}, peak: bendPose('l'), peakAlt: bendPose('r') },

  nextPhase(f, current) {
    const s = f.torsoSideLean;
    if (current === 'center') return s < -C.enter ? 'left' : s > C.enter ? 'right' : 'center';
    return Math.abs(s) < C.center ? 'center' : current;
  },

  progress: (f) => Math.abs(f.torsoSideLean) / 30,

  peakAngle: (m) => Math.abs(m.peak),
  angleLabel: 'moves.angle.lean',

  initMetrics: (f) => ({ peak: f.torsoSideLean, hipX0: f.center.x, maxHipShift: 0 }),

  track: (m, f) => ({
    ...m,
    peak: Math.abs(f.torsoSideLean) > Math.abs(m.peak) ? f.torsoSideLean : m.peak,
    maxHipShift: Math.max(
      m.maxHipShift,
      Math.abs(f.center.x - m.hipX0) / Math.max(f.shoulderWidth, 1e-3),
    ),
  }),

  sideOf: (m) => (m.peak < 0 ? 'l' : 'r'),

  ghostFor: (f) => bendPose(f.torsoSideLean < 0 ? 'l' : 'r'),

  frameRules: [
    {
      kind: 'frame',
      id: 'sideBend.forward',
      severity: 'form',
      message: 'sideBend.forward.msg',
      fix: 'sideBend.forward.fix',
      joints: [P.leftShoulder, P.rightShoulder],
      persistMs: 300,
      test: (f) => f.torsoPitch > C.pitchMax,
    },
    {
      kind: 'frame',
      id: 'sideBend.knees',
      severity: 'form',
      message: 'sideBend.knees.msg',
      fix: 'sideBend.knees.fix',
      joints: [P.leftKnee, P.rightKnee],
      persistMs: 300,
      test: (f) => Math.min(f.kneeAngle.l, f.kneeAngle.r) < C.kneeMin,
    },
  ],

  repRules: [
    {
      kind: 'rep',
      id: 'sideBend.depth',
      severity: 'validity',
      message: 'sideBend.depth.msg',
      fix: 'sideBend.depth.fix',
      joints: [P.leftShoulder, P.rightShoulder],
      invalidates: true,
      test: (m) => Math.abs(m.peak) < C.depthMin,
    },
    {
      kind: 'rep',
      id: 'sideBend.hips',
      severity: 'form',
      message: 'sideBend.hips.msg',
      fix: 'sideBend.hips.fix',
      joints: [P.leftHip, P.rightHip],
      test: (m) => m.maxHipShift > C.hipShiftMax,
    },
  ],
};

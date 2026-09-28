import { P, type FrameFeatures } from '@/core/types';
import type { ExerciseDefinition } from '@/engine/types';
import { JACK as C } from './config';
import { jackOpen } from './reference';

export interface JackMetrics {
  maxStance: number;
  handsOverhead: boolean;
}

const arms = (f: FrameFeatures) => (f.shoulderAngle.l + f.shoulderAngle.r) / 2;

export const jumpingJack: ExerciseDefinition<JackMetrics> = {
  id: 'jumpingJack',
  name: 'jumpingJack.name',
  howTo: 'jumpingJack.howTo',
  view: 'front',
  needs: ['upper', 'lower', 'feet'],
  phases: ['closed', 'open'],
  initialPhase: 'closed',
  repStart: 'closed',
  // jacks are fast: ~2 per second is a normal pace
  minRepMs: 200,
  keyframes: { rest: {}, peak: jackOpen() },

  nextPhase(f, current) {
    const a = arms(f);
    if (current === 'closed') return a > C.openEnter ? 'open' : 'closed';
    return a < C.closedEnter ? 'closed' : 'open';
  },

  progress: (f) => arms(f) / 165,

  initMetrics: (f) => ({ maxStance: f.stanceRatio, handsOverhead: false }),

  track: (m, f) => ({
    maxStance: Math.max(m.maxStance, f.stanceRatio),
    handsOverhead: m.handsOverhead || (f.wristAboveHead.l && f.wristAboveHead.r),
  }),

  frameRules: [
    {
      kind: 'frame',
      id: 'jumpingJack.bentArms',
      severity: 'form',
      message: 'jumpingJack.bentArms.msg',
      fix: 'jumpingJack.bentArms.fix',
      phases: ['open'],
      joints: [P.leftElbow, P.rightElbow],
      persistMs: 250,
      test: (f) => arms(f) > 140 && Math.min(f.elbowAngle.l, f.elbowAngle.r) < C.elbowMin,
    },
  ],

  repRules: [
    {
      kind: 'rep',
      id: 'jumpingJack.armsLow',
      severity: 'validity',
      message: 'jumpingJack.armsLow.msg',
      fix: 'jumpingJack.armsLow.fix',
      joints: [P.leftWrist, P.rightWrist],
      arrows: [
        { joint: P.leftWrist, dir: [0, -1] },
        { joint: P.rightWrist, dir: [0, -1] },
      ],
      invalidates: true,
      test: (m) => !m.handsOverhead,
    },
    {
      kind: 'rep',
      id: 'jumpingJack.noLegs',
      severity: 'validity',
      message: 'jumpingJack.noLegs.msg',
      fix: 'jumpingJack.noLegs.fix',
      joints: [P.leftAnkle, P.rightAnkle, P.leftKnee, P.rightKnee],
      arrows: [
        { joint: P.leftAnkle, dir: [-1, 0] },
        { joint: P.rightAnkle, dir: [1, 0] },
      ],
      invalidates: true,
      test: (m) => m.maxStance < C.stanceMoved,
    },
    {
      kind: 'rep',
      id: 'jumpingJack.narrow',
      severity: 'form',
      message: 'jumpingJack.narrow.msg',
      fix: 'jumpingJack.narrow.fix',
      joints: [P.leftAnkle, P.rightAnkle],
      arrows: [
        { joint: P.leftAnkle, dir: [-1, 0] },
        { joint: P.rightAnkle, dir: [1, 0] },
      ],
      test: (m) => m.maxStance >= C.stanceMoved && m.maxStance < C.stanceGood,
    },
  ],
};

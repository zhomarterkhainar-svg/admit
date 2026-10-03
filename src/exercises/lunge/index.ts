import { P, type FrameFeatures } from '@/core/types';
import type { ExerciseDefinition, Side } from '@/engine/types';
import { LUNGE as C } from './config';
import { lungeDown } from './reference';

export interface LungeMetrics {
  minFrontKnee: number;
  minBackKnee: number;
  /** front leg at the deepest point */
  front: Side;
  minAvgKnee: number;
}

const avgKnee = (f: FrameFeatures) => (f.kneeAngle.l + f.kneeAngle.r) / 2;
/** Front leg = the knee closer to hip height (thigh points at the camera). */
const frontLeg = (f: FrameFeatures): Side => (f.kneeDrop.l < f.kneeDrop.r ? 'l' : 'r');
const other = (s: Side): Side => (s === 'l' ? 'r' : 'l');

export const lunge: ExerciseDefinition<LungeMetrics> = {
  id: 'lunge',
  name: 'lunge.name',
  howTo: 'lunge.howTo',
  view: 'front',
  needs: ['lower', 'feet'],
  phases: ['up', 'down'],
  initialPhase: 'up',
  repStart: 'up',
  keyframes: { rest: {}, peak: lungeDown('l'), peakAlt: lungeDown('r') },

  nextPhase(f, current) {
    const k = avgKnee(f);
    if (current === 'up') return k < C.downEnter ? 'down' : 'up';
    return k > C.upEnter ? 'up' : 'down';
  },

  progress: (f) => (175 - avgKnee(f)) / (175 - 95),

  peakAngle: (m) => m.minFrontKnee,
  angleLabel: 'moves.angle.frontKnee',

  initMetrics: (f) => {
    const front = frontLeg(f);
    return {
      front,
      minFrontKnee: f.kneeAngle[front],
      minBackKnee: f.kneeAngle[other(front)],
      minAvgKnee: avgKnee(f),
    };
  },

  track(m, f) {
    const k = avgKnee(f);
    const front = k < m.minAvgKnee ? frontLeg(f) : m.front;
    return {
      front,
      minAvgKnee: Math.min(m.minAvgKnee, k),
      minFrontKnee: Math.min(m.minFrontKnee, f.kneeAngle[front]),
      minBackKnee: Math.min(m.minBackKnee, f.kneeAngle[other(front)]),
    };
  },

  sideOf: (m) => m.front,

  ghostFor: (f) => lungeDown(frontLeg(f)),

  frameRules: [
    {
      kind: 'frame',
      id: 'lunge.kneeIn',
      severity: 'safety',
      message: 'lunge.kneeIn.msg',
      fix: 'lunge.kneeIn.fix',
      phases: ['down'],
      joints: [P.leftKnee, P.rightKnee],
      persistMs: 250,
      test: (f) => f.kneeInward[frontLeg(f)] > C.kneeInwardMax,
    },
    {
      kind: 'frame',
      id: 'lunge.torso',
      severity: 'form',
      message: 'lunge.torso.msg',
      fix: 'lunge.torso.fix',
      phases: ['down'],
      joints: [P.leftShoulder, P.rightShoulder, P.leftHip, P.rightHip],
      arrows: [{ joint: P.leftShoulder, dir: [0, -1] }],
      persistMs: 300,
      test: (f) => f.torsoLean > C.torsoMax,
    },
    {
      kind: 'frame',
      id: 'lunge.balance',
      severity: 'form',
      message: 'lunge.balance.msg',
      fix: 'lunge.balance.fix',
      phases: ['down'],
      joints: [P.leftShoulder, P.rightShoulder],
      persistMs: 300,
      test: (f) => Math.abs(f.torsoSideLean) > C.sideLeanMax,
    },
  ],

  repRules: [
    {
      kind: 'rep',
      id: 'lunge.depth',
      severity: 'validity',
      message: 'lunge.depth.msg',
      fix: 'lunge.depth.fix',
      joints: [P.leftKnee, P.rightKnee, P.leftHip, P.rightHip],
      arrows: [
        { joint: P.leftHip, dir: [0, 1] },
        { joint: P.rightHip, dir: [0, 1] },
      ],
      invalidates: true,
      test: (m) => m.minFrontKnee > C.frontKneeMax,
    },
    {
      kind: 'rep',
      id: 'lunge.backKnee',
      severity: 'form',
      message: 'lunge.backKnee.msg',
      fix: 'lunge.backKnee.fix',
      joints: [P.leftKnee, P.rightKnee],
      test: (m) => m.minFrontKnee <= C.frontKneeMax && m.minBackKnee > C.backKneeMax,
    },
  ],
};

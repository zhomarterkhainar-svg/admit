import { P, type FrameFeatures } from '@/core/types';
import type { ExerciseDefinition } from '@/engine/types';
import { SQUAT as C } from './config';

export interface SquatMetrics {
  minKnee: number;
  startT: number;
  minKneeT: number;
}

const knee = (f: FrameFeatures) => (f.kneeAngle.l + f.kneeAngle.r) / 2;

export const squat: ExerciseDefinition<SquatMetrics> = {
  id: 'squat',
  name: 'squat.name',
  howTo: 'squat.howTo',
  view: 'front',
  needs: ['lower', 'feet'],
  phases: ['up', 'down'],
  initialPhase: 'up',
  repStart: 'up',

  nextPhase(f, current) {
    const k = knee(f);
    if (current === 'up') return k < C.downEnter ? 'down' : 'up';
    return k > C.upEnter ? 'up' : 'down';
  },

  progress: (f) => (175 - knee(f)) / (175 - 90),

  initMetrics: (f) => ({ minKnee: knee(f), startT: f.t, minKneeT: f.t }),

  track(m, f) {
    const k = knee(f);
    return k < m.minKnee ? { ...m, minKnee: k, minKneeT: f.t } : m;
  },

  frameRules: [
    {
      kind: 'frame',
      id: 'squat.valgus',
      severity: 'safety',
      message: 'squat.valgus.msg',
      fix: 'squat.valgus.fix',
      phases: ['down'],
      joints: [P.leftKnee, P.rightKnee],
      arrow: { joint: P.leftKnee, dir: [-1, 0] },
      persistMs: 250,
      test: (f) => f.kneeAngle.l < 130 && f.kneeAnkleRatio < C.valgusRatio,
    },
    {
      kind: 'frame',
      id: 'squat.torso',
      severity: 'form',
      message: 'squat.torso.msg',
      fix: 'squat.torso.fix',
      phases: ['down'],
      joints: [P.leftShoulder, P.rightShoulder, P.leftHip, P.rightHip],
      arrow: { joint: P.leftShoulder, dir: [0, -1] },
      persistMs: 300,
      test: (f) => f.torsoLean > C.torsoLeanMax,
    },
    {
      kind: 'frame',
      id: 'squat.asym',
      severity: 'form',
      message: 'squat.asym.msg',
      fix: 'squat.asym.fix',
      phases: ['down'],
      joints: [P.leftKnee, P.rightKnee, P.leftHip, P.rightHip],
      persistMs: 300,
      test: (f) => Math.abs(f.kneeAngle.l - f.kneeAngle.r) > C.asymMax,
    },
    {
      kind: 'frame',
      id: 'squat.stance',
      severity: 'form',
      message: 'squat.stance.msg',
      fix: 'squat.stance.fix',
      joints: [P.leftAnkle, P.rightAnkle],
      persistMs: 700,
      test: (f) => f.stanceRatio < C.stanceMin,
    },
  ],

  repRules: [
    {
      kind: 'rep',
      id: 'squat.depth',
      severity: 'validity',
      message: 'squat.depth.msg',
      fix: 'squat.depth.fix',
      joints: [P.leftHip, P.rightHip, P.leftKnee, P.rightKnee],
      arrow: { joint: P.leftHip, dir: [0, 1] },
      invalidates: true,
      test: (m) => m.minKnee > C.depthMax,
    },
    {
      kind: 'rep',
      id: 'squat.tempo',
      severity: 'tempo',
      message: 'squat.tempo.msg',
      fix: 'squat.tempo.fix',
      joints: [],
      test: (m) => m.minKneeT - m.startT < C.minDescentMs,
    },
  ],
};

import { P } from '@/core/types';
import type { ExerciseDefinition } from '@/engine/types';
import { elbow, knee } from '../floorPose';
import { PUSHUP as C } from './config';
import { pushupDown, pushupTop } from './reference';

export interface PushupMetrics {
  minElbow: number;
  startT: number;
  minElbowT: number;
}

const HIPS = [P.leftHip, P.rightHip];

export const pushup: ExerciseDefinition<PushupMetrics> = {
  id: 'pushup',
  name: 'pushup.name',
  howTo: 'pushup.howTo',
  view: 'side',
  posture: 'floor',
  needs: ['upper', 'lower', 'feet'],
  phases: ['up', 'down'],
  initialPhase: 'up',
  repStart: 'up',
  keyframes: { rest: pushupTop(), peak: pushupDown() },

  nextPhase(f, current) {
    const e = elbow(f);
    if (current === 'up') return e < C.downEnter ? 'down' : 'up';
    return e > C.upEnter ? 'up' : 'down';
  },

  progress: (f) => (165 - elbow(f)) / (165 - 85),

  initMetrics: (f) => ({ minElbow: elbow(f), startT: f.t, minElbowT: f.t }),

  track(m, f) {
    const e = elbow(f);
    return e < m.minElbow ? { ...m, minElbow: e, minElbowT: f.t } : m;
  },

  frameRules: [
    {
      kind: 'frame',
      id: 'pushup.sag',
      severity: 'safety',
      message: 'pushup.sag.msg',
      fix: 'pushup.sag.fix',
      joints: HIPS,
      arrows: [{ joint: P.leftHip, dir: [0, -1] }],
      persistMs: 300,
      test: (f) => f.hipOffset > C.sagMax,
    },
    {
      kind: 'frame',
      id: 'pushup.pike',
      severity: 'form',
      message: 'pushup.pike.msg',
      fix: 'pushup.pike.fix',
      joints: HIPS,
      arrows: [{ joint: P.leftHip, dir: [0, 1] }],
      persistMs: 300,
      test: (f) => f.hipOffset < -C.pikeMax,
    },
    {
      kind: 'frame',
      id: 'pushup.knees',
      severity: 'form',
      message: 'pushup.knees.msg',
      fix: 'pushup.knees.fix',
      joints: [P.leftKnee, P.rightKnee],
      persistMs: 500,
      test: (f) => knee(f) < C.kneeMin,
    },
  ],

  repRules: [
    {
      kind: 'rep',
      id: 'pushup.depth',
      severity: 'validity',
      message: 'pushup.depth.msg',
      fix: 'pushup.depth.fix',
      joints: [P.leftElbow, P.rightElbow, P.leftShoulder, P.rightShoulder],
      arrows: [{ joint: P.leftShoulder, dir: [0, 1] }],
      invalidates: true,
      test: (m) => m.minElbow > C.depthMax,
    },
    {
      kind: 'rep',
      id: 'pushup.tempo',
      severity: 'tempo',
      message: 'pushup.tempo.msg',
      fix: 'pushup.tempo.fix',
      joints: [],
      test: (m) => m.minElbowT - m.startT < C.minDescentMs,
    },
  ],
};

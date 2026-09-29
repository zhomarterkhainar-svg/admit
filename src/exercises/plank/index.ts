import { P } from '@/core/types';
import type { ExerciseDefinition } from '@/engine/types';
import { FLOOR_TILT_MAX } from '@/engine/setupRules';
import { knee } from '../floorPose';
import { PLANK as C } from './config';
import { plankPose } from './reference';

const HIPS = [P.leftHip, P.rightHip];

/**
 * Plank hold: the timer runs only while the body is one straight line. Every held second
 * counts as a unit; sagging or piked hips are flagged (and cost quality) while it runs.
 */
export const plank: ExerciseDefinition<Record<string, never>> = {
  id: 'plank',
  name: 'plank.name',
  howTo: 'plank.howTo',
  view: 'side',
  posture: 'floor',
  needs: ['upper', 'lower', 'feet'],
  phases: ['out', 'hold'],
  initialPhase: 'out',
  repStart: 'out',
  hold: { phase: 'hold' },
  meterLabel: 'plank.meter',
  keyframes: { rest: plankPose(0.22), peak: plankPose() },

  nextPhase(f, current) {
    const off = Math.abs(f.hipOffset);
    if (current === 'out')
      return off < C.holdEnter && knee(f) > C.kneeMin && f.bodyTilt < C.tiltMax ? 'hold' : 'out';
    return off > C.holdExit || knee(f) < C.kneeMin - 10 || f.bodyTilt > C.tiltMax + 5
      ? 'out'
      : 'hold';
  },

  /** straightness: 1 = perfect line, 0 = about to drop out of the plank */
  progress: (f) => 1 - Math.abs(f.hipOffset) / C.holdExit,

  initMetrics: () => ({}),
  track: (m) => m,

  frameRules: [
    {
      kind: 'frame',
      id: 'plank.sag',
      severity: 'form',
      message: 'plank.sag.msg',
      fix: 'plank.sag.fix',
      phases: ['hold'],
      joints: HIPS,
      arrows: [{ joint: P.leftHip, dir: [0, -1] }],
      persistMs: 400,
      test: (f) => f.hipOffset > C.sagMax,
    },
    {
      kind: 'frame',
      id: 'plank.pike',
      severity: 'form',
      message: 'plank.pike.msg',
      fix: 'plank.pike.fix',
      phases: ['hold'],
      joints: HIPS,
      arrows: [{ joint: P.leftHip, dir: [0, 1] }],
      persistMs: 400,
      test: (f) => f.hipOffset < -C.pikeMax,
    },
    {
      kind: 'frame',
      id: 'plank.broken',
      severity: 'validity',
      message: 'plank.broken.msg',
      fix: 'plank.broken.fix',
      phases: ['out'],
      joints: [...HIPS, P.leftKnee, P.rightKnee],
      persistMs: 700,
      test: (f) => f.bodyTilt < FLOOR_TILT_MAX,
    },
  ],

  repRules: [],
};

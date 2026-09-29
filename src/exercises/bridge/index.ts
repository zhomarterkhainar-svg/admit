import { P } from '@/core/types';
import type { ExerciseDefinition } from '@/engine/types';
import { hip, knee } from '../floorPose';
import { BRIDGE as C } from './config';
import { bridgeDown, bridgeUp } from './reference';

export interface BridgeMetrics {
  maxHip: number;
  /** knee angle when the hips were highest */
  kneeAtTop: number;
  /** longest time spent at the top */
  topMs: number;
}

export const bridge: ExerciseDefinition<BridgeMetrics> = {
  id: 'bridge',
  name: 'bridge.name',
  howTo: 'bridge.howTo',
  view: 'side',
  posture: 'floor',
  needs: ['upper', 'lower', 'feet'],
  phases: ['down', 'up'],
  initialPhase: 'down',
  repStart: 'down',
  keyframes: { rest: bridgeDown(), peak: bridgeUp() },

  nextPhase(f, current) {
    const h = hip(f);
    if (current === 'down') return h > C.upEnter ? 'up' : 'down';
    return h < C.downEnter ? 'down' : 'up';
  },

  progress: (f) => (hip(f) - 125) / (175 - 125),

  initMetrics: (f) => ({ maxHip: hip(f), kneeAtTop: knee(f), topMs: 0 }),

  track(m, f, ctx) {
    const h = hip(f);
    return {
      maxHip: Math.max(m.maxHip, h),
      kneeAtTop: h >= m.maxHip ? knee(f) : m.kneeAtTop,
      topMs: ctx.phase === 'up' ? Math.max(m.topMs, ctx.phaseMs) : m.topMs,
    };
  },

  frameRules: [],

  repRules: [
    {
      kind: 'rep',
      id: 'bridge.height',
      severity: 'validity',
      message: 'bridge.height.msg',
      fix: 'bridge.height.fix',
      joints: [P.leftHip, P.rightHip],
      arrows: [{ joint: P.leftHip, dir: [0, -1] }],
      invalidates: true,
      test: (m) => m.maxHip < C.heightMin,
    },
    {
      kind: 'rep',
      id: 'bridge.feet',
      severity: 'form',
      message: 'bridge.feet.msg',
      fix: 'bridge.feet.fix',
      joints: [P.leftKnee, P.rightKnee, P.leftAnkle, P.rightAnkle],
      test: (m) => m.kneeAtTop > C.kneeMax,
    },
    {
      kind: 'rep',
      id: 'bridge.tempo',
      severity: 'tempo',
      message: 'bridge.tempo.msg',
      fix: 'bridge.tempo.fix',
      joints: [],
      test: (m) => m.topMs < C.minTopMs,
    },
  ],
};

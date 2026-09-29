import { P, type FrameFeatures } from '@/core/types';
import type { ExerciseDefinition, Gauge } from '@/engine/types';
import { elbow, flare, floorView, knee, nearSide } from '../floorPose';
import { PUSHUP as C } from './config';
import { pushupDown, pushupTop } from './reference';

export interface PushupMetrics {
  minElbow: number;
  startT: number;
  minElbowT: number;
  /** elbow flare (upper arm to torso) at the deepest point of the rep */
  flareAtBottom: number;
}

const HIPS = [P.leftHip, P.rightHip];
const ELBOWS = [P.leftElbow, P.rightElbow, P.leftShoulder, P.rightShoulder];

/** Hips below (+) / above (−) the body line: the image line from the side, 3D from the front. */
const sagged = (f: FrameFeatures) =>
  floorView(f) === 'front' ? f.hipLineOffsetW > C.sagMaxW : f.hipOffset > C.sagMax;
const piked = (f: FrameFeatures) =>
  floorView(f) === 'front' ? f.hipLineOffsetW < -C.pikeMaxW : f.hipOffset < -C.pikeMax;

/**
 * Push-ups, filmed from the side OR from the front (camera ahead of the head). Counts on the
 * elbow angle, checks depth (≤ 100° at the bottom), a straight body, straight legs and — the
 * mistake most people make — elbows flared out to the sides instead of ~45° to the body.
 * The elbow angle is shown live on the skeleton.
 */
export const pushup: ExerciseDefinition<PushupMetrics> = {
  id: 'pushup',
  name: 'pushup.name',
  howTo: 'pushup.howTo',
  view: 'side',
  posture: 'floor',
  floorViews: ['side', 'front'],
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

  initMetrics: (f) => ({
    minElbow: elbow(f),
    startT: f.t,
    minElbowT: f.t,
    flareAtBottom: flare(f),
  }),

  track(m, f) {
    const e = elbow(f);
    return e < m.minElbow ? { ...m, minElbow: e, minElbowT: f.t, flareAtBottom: flare(f) } : m;
  },

  gauges(f) {
    const e = elbow(f);
    // green once deep enough, orange while bent but still too shallow, neutral at the top
    const tone = e <= C.depthMax ? 'good' : e < C.downEnter ? 'warn' : undefined;
    const sides = floorView(f) === 'front' ? (['l', 'r'] as const) : [nearSide(f)];
    return sides.map((s): Gauge => ({
      at: s === 'l' ? P.leftElbow : P.rightElbow,
      from: s === 'l' ? P.leftShoulder : P.rightShoulder,
      to: s === 'l' ? P.leftWrist : P.rightWrist,
      deg: f.elbowAngle[s],
      tone,
    }));
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
      test: sagged,
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
      test: piked,
    },
    {
      kind: 'frame',
      id: 'pushup.knees',
      severity: 'form',
      message: 'pushup.knees.msg',
      fix: 'pushup.knees.fix',
      joints: [P.leftKnee, P.rightKnee],
      persistMs: 500,
      // from the front the knees are hidden behind the body: their angle is a guess there
      test: (f) => floorView(f) === 'side' && knee(f) < C.kneeMin,
    },
    {
      kind: 'frame',
      id: 'pushup.flare',
      severity: 'safety',
      message: 'pushup.flare.msg',
      fix: 'pushup.flare.fix',
      phases: ['down'],
      joints: ELBOWS,
      persistMs: 250,
      test: (f) => elbow(f) < C.flareBelowElbow && flare(f) > C.flareMax,
    },
  ],

  repRules: [
    {
      kind: 'rep',
      id: 'pushup.depth',
      severity: 'validity',
      message: 'pushup.depth.msg',
      fix: 'pushup.depth.fix',
      joints: ELBOWS,
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

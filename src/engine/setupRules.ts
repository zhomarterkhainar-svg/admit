import { P, type FrameFeatures } from '@/core/types';
import type { FrameRule, Hint } from './types';

/** Below this mean luminance the camera image is too dark for reliable tracking. */
export const DARK_THRESHOLD = 0.16;

/** Shown when the frame is too dark (also explains "can't see you"). */
export const TOO_DARK: Hint = {
  id: 'setup.dark',
  severity: 'setup',
  message: 'setup.dark.msg',
  fix: 'setup.dark.fix',
  joints: [],
};

/** Shown when nobody is detected at all. */
export const NO_PERSON: Hint = {
  id: 'setup.noPerson',
  severity: 'setup',
  message: 'setup.noPerson.msg',
  fix: 'setup.noPerson.fix',
  joints: [],
};

/**
 * Framing / environment checks shared by all exercises. Highest priority in the arbiter:
 * while any is active the rep counter is paused. Other people in frame are NOT a problem:
 * PersonLock follows the player and ignores passers-by.
 */
const DARK_RULE: FrameRule = {
  ...TOO_DARK,
  kind: 'frame',
  persistMs: 1000,
  test: (_f, ctx) => ctx.brightness !== undefined && ctx.brightness < DARK_THRESHOLD,
};

/** Above this body tilt (degrees from horizontal) the player is not down on the floor yet. */
export const FLOOR_TILT_MAX = 40;

/** Visibility of a joint on the side facing the camera (the far side is hidden in a side view). */
const nearSide = (f: FrameFeatures, l: number, r: number) =>
  Math.max(f.jointVisibility[l] ?? 0, f.jointVisibility[r] ?? 0);
/** Visibility of a joint pair when both must be seen (front view: both arms). */
const bothSides = (f: FrameFeatures, l: number, r: number) =>
  Math.min(f.jointVisibility[l] ?? 0, f.jointVisibility[r] ?? 0);

/**
 * Where the camera is for a floor exercise. From the side the shoulders overlap in the picture
 * (narrow) and the torso is long; from the front (camera ahead of the head) the shoulders are
 * wide and the torso is foreshortened to almost nothing. frontality = shoulder width / torso.
 */
export const FRONT_FRONTALITY = 0.85;
export const floorView = (f: FrameFeatures): 'side' | 'front' =>
  f.frontality >= FRONT_FRONTALITY ? 'front' : 'side';
/** From the front the image body line collapses: "lying" = the 3D torso is far from upright. */
export const FLOOR_TORSO_LEAN_MIN = 45;

/**
 * Framing for floor exercises: the body visible and actually down on the floor (before that the
 * counter waits and shows how to start). From the side the whole body, head to heels; from the
 * front (only for exercises that allow it) the head, shoulders and both arms — the legs are
 * hidden behind the body there. Side-only exercises seen from the front ask to turn sideways.
 */
export function floorSetupRules(
  views: ReadonlyArray<'side' | 'front'> = ['side'],
): FrameRule[] {
  const front = views.includes('front');
  const rules: FrameRule[] = [
    DARK_RULE,
    {
      kind: 'frame',
      id: 'setup.floorBody',
      severity: 'setup',
      message: 'setup.floorBody.msg',
      fix: 'setup.floorBody.fix',
      joints: [],
      persistMs: 500,
      test: (f) =>
        front && floorView(f) === 'front'
          ? Math.min(
              bothSides(f, P.leftShoulder, P.rightShoulder),
              bothSides(f, P.leftElbow, P.rightElbow),
            ) < 0.5
          : Math.min(
              nearSide(f, P.leftShoulder, P.rightShoulder),
              nearSide(f, P.leftHip, P.rightHip),
              nearSide(f, P.leftAnkle, P.rightAnkle),
            ) < 0.5,
    },
    {
      kind: 'frame',
      id: 'setup.floorDown',
      severity: 'setup',
      message: 'setup.floorDown.msg',
      fix: 'setup.floorDown.fix',
      joints: [],
      persistMs: 400,
      test: (f) =>
        floorView(f) === 'front'
          ? f.torsoLean < FLOOR_TORSO_LEAN_MIN
          : f.bodyTilt > FLOOR_TILT_MAX,
    },
  ];
  if (!front)
    rules.push({
      kind: 'frame',
      id: 'setup.floorSide',
      severity: 'setup',
      message: 'setup.floorSide.msg',
      fix: 'setup.floorSide.fix',
      joints: [],
      persistMs: 700,
      test: (f) => floorView(f) === 'front' && f.torsoLean >= FLOOR_TORSO_LEAN_MIN,
    });
  return rules;
}

export function setupRules(
  needs: ReadonlyArray<'upper' | 'lower' | 'feet'>,
  view: 'front' | 'side',
): FrameRule[] {
  const rules: FrameRule[] = [
    DARK_RULE,
    {
      kind: 'frame',
      id: 'setup.tooClose',
      severity: 'setup',
      message: 'setup.tooClose.msg',
      fix: 'setup.tooClose.fix',
      joints: [],
      persistMs: 400,
      test: (f) => f.bodyHeightFrac > 1.05 || (needs.includes('feet') && f.visibility.feet < 0.5),
    },
    {
      kind: 'frame',
      id: 'setup.tooFar',
      severity: 'setup',
      message: 'setup.tooFar.msg',
      fix: 'setup.tooFar.fix',
      joints: [],
      persistMs: 600,
      test: (f) => f.bodyHeightFrac < 0.4 && f.visibility.feet > 0.5,
    },
    {
      kind: 'frame',
      id: 'setup.offCenter',
      severity: 'setup',
      message: 'setup.offCenter.msg',
      fix: 'setup.offCenter.fix',
      joints: [P.leftHip, P.rightHip],
      persistMs: 600,
      test: (f) => f.center.x < 0.2 || f.center.x > 0.8,
    },
  ];
  if (needs.includes('upper')) {
    rules.push({
      kind: 'frame',
      id: 'setup.armsHidden',
      severity: 'setup',
      message: 'setup.armsHidden.msg',
      fix: 'setup.armsHidden.fix',
      joints: [P.leftWrist, P.rightWrist],
      persistMs: 500,
      test: (f) => f.visibility.upper < 0.4,
    });
  }
  if (view === 'front') {
    rules.push({
      kind: 'frame',
      id: 'setup.notFacing',
      severity: 'setup',
      message: 'setup.notFacing.msg',
      fix: 'setup.notFacing.fix',
      joints: [P.leftShoulder, P.rightShoulder],
      persistMs: 800,
      test: (f) => f.frontality < 0.45,
    });
  }
  return rules;
}

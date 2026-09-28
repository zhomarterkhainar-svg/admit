// Shared contracts between Vision (Dev A), Engine (Dev B), UI (Dev C) and Game (Dev D).
// Change these only via PR with everyone's review.

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** One processed camera frame for a single person. */
export interface PoseFrame {
  /** ms, performance.now() at capture time */
  t: number;
  /** 33 landmarks, normalized image coords [0..1] (NOT mirrored) */
  image: Landmark[];
  /** 33 landmarks in meters, origin at hip center (MediaPipe world landmarks) */
  world: Landmark[];
  /** source video size in px */
  width: number;
  height: number;
}

export interface LR<T> {
  l: T;
  r: T;
}

/** Derived per-frame features consumed by exercises, rules and gestures. Angles in degrees. */
export interface FrameFeatures {
  t: number;
  kneeAngle: LR<number>;
  hipAngle: LR<number>;
  elbowAngle: LR<number>;
  /** angle between torso and upper arm (0 = arm down along body, 180 = straight up) */
  shoulderAngle: LR<number>;
  /** forward/backward lean of torso from vertical, degrees (0 = upright) */
  torsoLean: number;
  /** sideways lean of torso, degrees; negative = user's left, positive = user's right */
  torsoSideLean: number;
  /** signed forward pitch of torso, degrees; + = leaning toward the camera, − = arching back */
  torsoPitch: number;
  /** ankle distance / shoulder width */
  stanceRatio: number;
  /** knee distance / ankle distance (< 1 means knees caving in) */
  kneeAnkleRatio: number;
  /** how far each knee is below the hips, in torso lengths (image space; ~0.85 standing, ~0 thigh toward camera) */
  kneeDrop: LR<number>;
  /** knee shift toward the body midline relative to its ankle, in shoulder widths (+ = inward) */
  kneeInward: LR<number>;
  /** world z of left ankle minus right ankle, meters (− = left foot closer to camera) */
  ankleZDiff: number;
  /** wrist y above nose y (image space) */
  wristAboveHead: LR<boolean>;
  /** wrist height relative to shoulder, normalized by torso length (+ = above shoulder) */
  wristLift: LR<number>;
  /** shoulder width in aspect-corrected image units (for normalizing distances) */
  shoulderWidth: number;
  /** fraction of frame height covered by the body (nose → ankles) */
  bodyHeightFrac: number;
  /** hip center in normalized image coords */
  center: { x: number; y: number };
  /** shoulder width / torso length; small when user is turned sideways */
  frontality: number;
  /** min visibility of key landmark groups */
  visibility: { upper: number; lower: number; feet: number };
}

/** MediaPipe Pose landmark indices. */
export const P = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

export type LandmarkIndex = (typeof P)[keyof typeof P];

/** Skeleton edges for rendering. */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [LandmarkIndex, LandmarkIndex]> = [
  [P.leftShoulder, P.rightShoulder],
  [P.leftShoulder, P.leftElbow],
  [P.leftElbow, P.leftWrist],
  [P.rightShoulder, P.rightElbow],
  [P.rightElbow, P.rightWrist],
  [P.leftShoulder, P.leftHip],
  [P.rightShoulder, P.rightHip],
  [P.leftHip, P.rightHip],
  [P.leftHip, P.leftKnee],
  [P.leftKnee, P.leftAnkle],
  [P.rightHip, P.rightKnee],
  [P.rightKnee, P.rightAnkle],
  [P.leftAnkle, P.leftHeel],
  [P.leftHeel, P.leftFootIndex],
  [P.leftAnkle, P.leftFootIndex],
  [P.rightAnkle, P.rightHeel],
  [P.rightHeel, P.rightFootIndex],
  [P.rightAnkle, P.rightFootIndex],
];

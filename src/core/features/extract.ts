import { P, type FrameFeatures, type Landmark, type PoseFrame } from '../types';
import {
  angleBetween,
  dist,
  dist2d,
  jointAngle,
  leanFromVertical2d,
  mid,
  sub,
  type Vec3,
} from '../geometry/vec';

const UP_WORLD: Vec3 = { x: 0, y: -1, z: 0 }; // MediaPipe world: y grows downward

const minVis = (lms: Landmark[], idx: number[]): number =>
  Math.min(...idx.map((i) => lms[i]?.visibility ?? 0));

/**
 * Turns a raw PoseFrame into view-independent features.
 * Joint angles use metric world landmarks (robust to distance from camera);
 * positional features use image landmarks corrected for aspect ratio.
 */
export function extractFeatures(frame: PoseFrame): FrameFeatures {
  const w = frame.world;
  const aspect = frame.width / frame.height;
  // aspect-corrected image space: x scaled so 1 unit on x == 1 unit on y
  const im = frame.image.map((l) => ({
    x: l.x * aspect,
    y: l.y,
    z: l.z,
    visibility: l.visibility,
  }));
  const g = (arr: Landmark[], i: number) => arr[i]!;

  const angles = (a: number, b: number, c: number) => jointAngle(g(w, a), g(w, b), g(w, c));

  const shoulderMidW = mid(g(w, P.leftShoulder), g(w, P.rightShoulder));
  const hipMidW = mid(g(w, P.leftHip), g(w, P.rightHip));
  const torsoW = sub(shoulderMidW, hipMidW);

  const shoulderMidI = mid(g(im, P.leftShoulder), g(im, P.rightShoulder));
  const hipMidI = mid(g(im, P.leftHip), g(im, P.rightHip));
  // image z is a noisy relative depth: use 2D distances in image space
  const torsoLenI = Math.max(dist2d(shoulderMidI, hipMidI), 1e-6);
  const shoulderWidthI = dist2d(g(im, P.leftShoulder), g(im, P.rightShoulder));

  const shoulderWidthW = Math.max(dist(g(w, P.leftShoulder), g(w, P.rightShoulder)), 1e-6);
  const ankleDistW = dist(g(w, P.leftAnkle), g(w, P.rightAnkle));
  const kneeDistW = dist(g(w, P.leftKnee), g(w, P.rightKnee));

  const noseY = g(frame.image, P.nose).y;
  const feetY = Math.max(
    g(frame.image, P.leftAnkle).y,
    g(frame.image, P.rightAnkle).y,
    g(frame.image, P.leftHeel).y,
    g(frame.image, P.rightHeel).y,
  );

  const shoulderWidthN = Math.max(shoulderWidthI, 1e-6);
  const kneeInwardL = (g(im, P.leftAnkle).x - g(im, P.leftKnee).x) / shoulderWidthN;
  const kneeInwardR = (g(im, P.rightKnee).x - g(im, P.rightAnkle).x) / shoulderWidthN;

  // floor exercises (side view): the body line from the shoulders to the ankles
  const ankleMidI = mid(g(im, P.leftAnkle), g(im, P.rightAnkle));
  const body = sub(ankleMidI, shoulderMidI);
  const bodyLen = Math.max(Math.hypot(body.x, body.y), 1e-6);
  // unit normal of the body line pointing down (toward the floor, image +y)
  const flip = body.x < 0 ? -1 : 1;
  const nx = (-body.y / bodyLen) * flip;
  const ny = (body.x / bodyLen) * flip;

  const wristLift = (shoulder: number, wrist: number) =>
    (g(im, shoulder).y - g(im, wrist).y) / torsoLenI;

  // world body line shoulders → knees; the hips' vertical (world y, down) distance from it
  const kneeMidW = mid(g(w, P.leftKnee), g(w, P.rightKnee));
  const lineW = sub(kneeMidW, shoulderMidW);
  const lineLenW = Math.max(Math.hypot(lineW.x, lineW.y, lineW.z), 1e-6);
  const hipRelW = sub(hipMidW, shoulderMidW);
  const alongW = Math.min(
    1,
    Math.max(0, (hipRelW.x * lineW.x + hipRelW.y * lineW.y + hipRelW.z * lineW.z) / lineLenW ** 2),
  );
  const hipLineOffsetW = (hipRelW.y - alongW * lineW.y) / lineLenW;

  return {
    t: frame.t,
    kneeAngle: {
      l: angles(P.leftHip, P.leftKnee, P.leftAnkle),
      r: angles(P.rightHip, P.rightKnee, P.rightAnkle),
    },
    hipAngle: {
      l: angles(P.leftShoulder, P.leftHip, P.leftKnee),
      r: angles(P.rightShoulder, P.rightHip, P.rightKnee),
    },
    elbowAngle: {
      l: angles(P.leftShoulder, P.leftElbow, P.leftWrist),
      r: angles(P.rightShoulder, P.rightElbow, P.rightWrist),
    },
    shoulderAngle: {
      l: angles(P.leftHip, P.leftShoulder, P.leftElbow),
      r: angles(P.rightHip, P.rightShoulder, P.rightElbow),
    },
    torsoLean: angleBetween(torsoW, UP_WORLD),
    // image is not mirrored: user's left side appears on image right (+x)
    torsoSideLean: -leanFromVertical2d(hipMidI, shoulderMidI),
    // world z grows away from camera: leaning toward camera makes torso.z negative
    torsoPitch: (Math.atan2(-torsoW.z, -torsoW.y) * 180) / Math.PI,
    stanceRatio: ankleDistW / shoulderWidthW,
    kneeAnkleRatio: kneeDistW / Math.max(ankleDistW, 1e-6),
    kneeDrop: {
      l: (g(im, P.leftKnee).y - hipMidI.y) / torsoLenI,
      r: (g(im, P.rightKnee).y - hipMidI.y) / torsoLenI,
    },
    kneeInward: { l: kneeInwardL, r: kneeInwardR },
    ankleZDiff: g(w, P.leftAnkle).z - g(w, P.rightAnkle).z,
    wristAboveHead: {
      l: g(frame.image, P.leftWrist).y < noseY,
      r: g(frame.image, P.rightWrist).y < noseY,
    },
    wristLift: {
      l: wristLift(P.leftShoulder, P.leftWrist),
      r: wristLift(P.rightShoulder, P.rightWrist),
    },
    bodyTilt: (Math.atan2(Math.abs(body.y), Math.abs(body.x)) * 180) / Math.PI,
    hipOffset: ((hipMidI.x - shoulderMidI.x) * nx + (hipMidI.y - shoulderMidI.y) * ny) / bodyLen,
    hipLineOffsetW,
    // nose→feet is ~87% of full height; scale so a person head-to-toe in frame ≈ 1
    bodyHeightFrac: (feetY - noseY) / 0.87,
    center: { x: (g(frame.image, P.leftHip).x + g(frame.image, P.rightHip).x) / 2, y: hipMidI.y },
    frontality: shoulderWidthI / torsoLenI,
    shoulderWidth: shoulderWidthI,
    jointVisibility: frame.image.map((l) => l.visibility),
    visibility: {
      upper: minVis(frame.image, [
        P.leftShoulder,
        P.rightShoulder,
        P.leftElbow,
        P.rightElbow,
        P.leftWrist,
        P.rightWrist,
      ]),
      lower: minVis(frame.image, [P.leftHip, P.rightHip, P.leftKnee, P.rightKnee]),
      feet: minVis(frame.image, [P.leftAnkle, P.rightAnkle]),
    },
  };
}

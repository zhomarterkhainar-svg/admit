// the heavy MediaPipe bundle is loaded lazily (own chunk) so the welcome screen appears instantly
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark, PoseFrame } from '../types';

export type PoseModel = 'lite' | 'full';

const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const CDN_MODEL = (m: PoseModel) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${m}/float16/latest/pose_landmarker_${m}.task`;

const base = import.meta.env.BASE_URL;

/** Up to this many people are detected, so the player can be told apart from passers-by. */
const MAX_PEOPLE = 3;

/**
 * Thin wrapper over MediaPipe PoseLandmarker.
 * - prefers self-hosted wasm/models, falls back to CDN
 * - prefers GPU delegate, falls back to CPU
 * - returns everyone in frame; PersonLock (in PoseLoop) decides which one is the player
 */
export class PoseTracker {
  private lastTs = -1;

  private constructor(
    private readonly landmarker: PoseLandmarker,
    public readonly model: PoseModel,
    public readonly delegate: 'GPU' | 'CPU',
  ) {}

  static async create(model: PoseModel = 'lite'): Promise<PoseTracker> {
    // self-hosted first (fast, works behind strict networks), CDN as a fallback
    const sources = [
      { wasm: `${base}wasm`, model: `${base}models/pose_landmarker_${model}.task` },
      { wasm: CDN_WASM, model: CDN_MODEL(model) },
    ];
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    let lastError: unknown;
    for (const src of sources) {
      const fileset = await FilesetResolver.forVisionTasks(src.wasm);
      for (const delegate of ['GPU', 'CPU'] as const) {
        try {
          const landmarker = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: src.model, delegate },
            runningMode: 'VIDEO',
            numPoses: MAX_PEOPLE,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          return new PoseTracker(landmarker, model, delegate);
        } catch (err) {
          lastError = err;
          console.warn(`[pose] ${delegate} with ${src.model} failed`, err);
        }
      }
    }
    throw lastError;
  }

  /** Everyone in the frame, in no particular order (MediaPipe may reorder people between frames). */
  detect(source: HTMLVideoElement, tMs: number): PoseFrame[] {
    // MediaPipe requires strictly increasing timestamps
    const ts = tMs <= this.lastTs ? this.lastTs + 1 : tMs;
    this.lastTs = ts;
    const res = this.landmarker.detectForVideo(source, ts);
    const toLm = (l: { x: number; y: number; z: number; visibility?: number }): Landmark => ({
      x: l.x,
      y: l.y,
      z: l.z,
      visibility: l.visibility ?? 1,
    });
    return res.landmarks.map((lms, i) => ({
      t: tMs,
      image: lms.map(toLm),
      world: (res.worldLandmarks[i] ?? []).map(toLm),
      width: source.videoWidth,
      height: source.videoHeight,
    }));
  }

  close(): void {
    this.landmarker.close();
  }
}

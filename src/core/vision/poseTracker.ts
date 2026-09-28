import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark, PoseFrame } from '../types';

export type PoseModel = 'lite' | 'full';

const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const CDN_MODEL = (m: PoseModel) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${m}/float16/latest/pose_landmarker_${m}.task`;

const base = import.meta.env.BASE_URL;

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

export interface PoseDetection {
  /** largest person in frame, or null */
  frame: PoseFrame | null;
  /** number of people detected (for "only one person" setup hint) */
  people: number;
}

/**
 * Thin wrapper over MediaPipe PoseLandmarker.
 * - prefers self-hosted wasm/models, falls back to CDN
 * - prefers GPU delegate, falls back to CPU
 * - picks the biggest person when several are visible
 */
export class PoseTracker {
  private lastTs = -1;

  private constructor(
    private readonly landmarker: PoseLandmarker,
    public readonly model: PoseModel,
    public readonly delegate: 'GPU' | 'CPU',
  ) {}

  static async create(model: PoseModel = 'lite'): Promise<PoseTracker> {
    const localWasm = `${base}wasm`;
    const wasmPath = (await exists(`${localWasm}/vision_wasm_internal.js`)) ? localWasm : CDN_WASM;
    const localModel = `${base}models/pose_landmarker_${model}.task`;
    const modelPath = (await exists(localModel)) ? localModel : CDN_MODEL(model);
    const fileset = await FilesetResolver.forVisionTasks(wasmPath);

    for (const delegate of ['GPU', 'CPU'] as const) {
      try {
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: modelPath, delegate },
          runningMode: 'VIDEO',
          numPoses: 2,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        return new PoseTracker(landmarker, model, delegate);
      } catch (err) {
        if (delegate === 'CPU') throw err;
        console.warn('[pose] GPU delegate failed, falling back to CPU', err);
      }
    }
    throw new Error('unreachable');
  }

  detect(source: HTMLVideoElement, tMs: number): PoseDetection {
    // MediaPipe requires strictly increasing timestamps
    const ts = tMs <= this.lastTs ? this.lastTs + 1 : tMs;
    this.lastTs = ts;
    const res = this.landmarker.detectForVideo(source, ts);
    const people = res.landmarks.length;
    if (people === 0) return { frame: null, people };

    let best = 0;
    let bestArea = -1;
    res.landmarks.forEach((lms, i) => {
      const xs = lms.map((l) => l.x);
      const ys = lms.map((l) => l.y);
      const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      if (area > bestArea) {
        bestArea = area;
        best = i;
      }
    });

    const toLm = (l: { x: number; y: number; z: number; visibility?: number }): Landmark => ({
      x: l.x,
      y: l.y,
      z: l.z,
      visibility: l.visibility ?? 1,
    });
    return {
      people,
      frame: {
        t: tMs,
        image: res.landmarks[best]!.map(toLm),
        world: res.worldLandmarks[best]!.map(toLm),
        width: source.videoWidth,
        height: source.videoHeight,
      },
    };
  }

  close(): void {
    this.landmarker.close();
  }
}

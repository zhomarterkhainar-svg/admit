// the heavy MediaPipe bundle is loaded lazily (own chunk / own worker) so the welcome screen
// appears instantly
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from '../types';
import type {
  ModelSource,
  PoseModel,
  Roi,
  VisionResult,
  WorkerRequest,
  WorkerResponse,
} from './visionTypes';

export type { PoseModel } from './visionTypes';

const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const CDN = 'https://storage.googleapis.com/mediapipe-models';
const CDN_POSE = (m: PoseModel) =>
  `${CDN}/pose_landmarker/pose_landmarker_${m}/float16/latest/pose_landmarker_${m}.task`;
const CDN_HAND = `${CDN}/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`;

/**
 * One person by default: MediaPipe then follows the player from frame to frame and runs its
 * (expensive) person detector only when the player is lost. With more slots than people in view
 * it would run the detector on EVERY frame looking for the others. Two-player modes raise it.
 */
const DEFAULT_PEOPLE = 1;
/**
 * The pose model looks at 256×256 crops anyway: feeding it a 480p copy instead of the full
 * 720p/1080p camera frame costs nothing in accuracy and a lot less upload / resize work.
 */
const INPUT_HEIGHT = 480;
/** side of the square hand crop handed to the hand model */
const HAND_CROP = 256;

/** self-hosted first (fast, works behind strict networks), CDN as a fallback */
function modelSources(model: PoseModel): ModelSource[] {
  const base = new URL(import.meta.env.BASE_URL, location.href).href;
  return [
    {
      wasm: `${base}wasm`,
      pose: `${base}models/pose_landmarker_${model}.task`,
      hand: `${base}models/hand_landmarker.task`,
    },
    { wasm: CDN_WASM, pose: CDN_POSE(model), hand: CDN_HAND },
  ];
}

/**
 * Finds people (and, on request, the cursor hand) in camera frames.
 * Prefers a Web Worker so inference never blocks the page; falls back to the main thread.
 */
export interface PoseTracker {
  readonly model: PoseModel;
  readonly delegate: 'GPU' | 'CPU';
  readonly where: 'worker' | 'main';
  /** hand crops are understood (open palm / fist) */
  readonly hands: boolean;
  /**
   * Everyone in the frame, in no particular order (MediaPipe may reorder people between frames).
   * @param handRoi if given, the hand inside this box (video px) is measured too
   */
  detect(video: HTMLVideoElement, tMs: number, handRoi?: Roi | null): Promise<VisionResult>;
  /** how many people to look for (1 = just the player; 2 for the duel) */
  setMaxPeople(n: number): void;
  close(): void;
}

export async function createPoseTracker(model: PoseModel = 'lite'): Promise<PoseTracker> {
  // `?worker=0` keeps inference on the main thread (debugging / comparing)
  const noWorker = new URLSearchParams(location.search).get('worker') === '0';
  if (!noWorker && typeof Worker !== 'undefined' && typeof createImageBitmap === 'function') {
    try {
      return await WorkerTracker.create(model);
    } catch (err) {
      console.warn('[pose] worker unavailable, running on the main thread', err);
    }
  }
  return MainThreadTracker.create(model);
}

class WorkerTracker implements PoseTracker {
  readonly where = 'worker';
  readonly hands = true;
  private nextId = 1;
  private readonly pending = new Map<number, (r: VisionResult) => void>();

  private constructor(
    private readonly worker: Worker,
    public readonly model: PoseModel,
    public readonly delegate: 'GPU' | 'CPU',
  ) {
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type !== 'result') return;
      this.pending.get(msg.id)?.(msg.result);
      this.pending.delete(msg.id);
    };
  }

  static async create(model: PoseModel): Promise<WorkerTracker> {
    const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
    try {
      const delegate = await new Promise<'GPU' | 'CPU'>((resolve, reject) => {
        // the worker downloads the model itself: allow for a slow connection
        const timer = setTimeout(() => reject(new Error('vision worker: init timeout')), 60000);
        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          if (e.data.type === 'ready') {
            clearTimeout(timer);
            resolve(e.data.delegate);
          } else if (e.data.type === 'error') {
            clearTimeout(timer);
            reject(new Error(e.data.message));
          }
        };
        worker.onerror = (e) => {
          clearTimeout(timer);
          reject(new Error(e.message || 'vision worker failed to start'));
        };
        const init: WorkerRequest = {
          type: 'init',
          model,
          sources: modelSources(model),
          numPoses: DEFAULT_PEOPLE,
        };
        worker.postMessage(init);
      });
      worker.onerror = null;
      return new WorkerTracker(worker, model, delegate);
    } catch (err) {
      worker.terminate();
      throw err;
    }
  }

  async detect(video: HTMLVideoElement, tMs: number, handRoi?: Roi | null): Promise<VisionResult> {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const k = Math.min(1, INPUT_HEIGHT / vh);
    const [frame, hand] = await Promise.all([
      createImageBitmap(video, {
        resizeWidth: Math.round(vw * k),
        resizeHeight: Math.round(vh * k),
        resizeQuality: 'low',
      }),
      handRoi
        ? createImageBitmap(
            video,
            Math.round(handRoi.x),
            Math.round(handRoi.y),
            Math.max(1, Math.round(handRoi.w)),
            Math.max(1, Math.round(handRoi.h)),
            { resizeWidth: HAND_CROP, resizeHeight: HAND_CROP, resizeQuality: 'medium' },
          )
        : undefined,
    ]);
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      const req: WorkerRequest = { type: 'detect', id, ts: tMs, frame, hand };
      this.worker.postMessage(req, hand ? [frame, hand] : [frame]);
    });
  }

  setMaxPeople(n: number): void {
    const req: WorkerRequest = { type: 'config', numPoses: n };
    this.worker.postMessage(req);
  }

  close(): void {
    this.worker.terminate();
    this.pending.forEach((resolve) => resolve({ people: [], ms: 0 }));
    this.pending.clear();
  }
}

/** Fallback: the same model on the main thread (no hand crops). */
class MainThreadTracker implements PoseTracker {
  readonly where = 'main';
  readonly hands = false;
  private lastTs = -1;

  private constructor(
    private readonly landmarker: PoseLandmarker,
    public readonly model: PoseModel,
    public readonly delegate: 'GPU' | 'CPU',
  ) {}

  static async create(model: PoseModel): Promise<MainThreadTracker> {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    let lastError: unknown;
    for (const src of modelSources(model)) {
      const fileset = await FilesetResolver.forVisionTasks(src.wasm);
      for (const delegate of ['GPU', 'CPU'] as const) {
        try {
          const landmarker = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: src.pose, delegate },
            runningMode: 'VIDEO',
            numPoses: DEFAULT_PEOPLE,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          return new MainThreadTracker(landmarker, model, delegate);
        } catch (err) {
          lastError = err;
          console.warn(`[pose] ${delegate} with ${src.pose} failed`, err);
        }
      }
    }
    throw lastError;
  }

  detect(video: HTMLVideoElement, tMs: number): Promise<VisionResult> {
    // MediaPipe requires strictly increasing timestamps
    const ts = tMs <= this.lastTs ? this.lastTs + 1 : tMs;
    this.lastTs = ts;
    const t0 = performance.now();
    const res = this.landmarker.detectForVideo(video, ts);
    const toLm = (l: { x: number; y: number; z: number; visibility?: number }): Landmark => ({
      x: l.x,
      y: l.y,
      z: l.z,
      visibility: l.visibility ?? 1,
    });
    return Promise.resolve({
      people: res.landmarks.map((lms, i) => ({
        image: lms.map(toLm),
        world: (res.worldLandmarks[i] ?? []).map(toLm),
      })),
      ms: performance.now() - t0,
    });
  }

  setMaxPeople(n: number): void {
    void this.landmarker.setOptions({ numPoses: n });
  }

  close(): void {
    this.landmarker.close();
  }
}

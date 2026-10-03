// the heavy MediaPipe bundle is loaded lazily (own chunk / own worker) so the welcome screen
// appears instantly
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark } from '../types';
import { THUMB_H, THUMB_W } from './visionTypes';
import type {
  HandState,
  ModelSource,
  PoseModel,
  Roi,
  VisionResult,
  WorkerRequest,
  WorkerResponse,
  WorkerTask,
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
   * @param thumb also return the frame as a THUMB_W×THUMB_H thumbnail (brightness, clothing)
   */
  detect(video: HTMLVideoElement, tMs: number, thumb?: boolean): Promise<VisionResult>;
  /**
   * The hand inside `roi` (video px), by the hand model in its own worker, in parallel with the
   * pose. null = no hand found (or the hand model is not up yet). Points are crop-normalized.
   */
  detectHand?(video: HTMLVideoElement, tMs: number, roi: Roi): Promise<HandState | null>;
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

/** One MediaPipe worker (pose or hand model) with request/response bookkeeping. */
class VisionWorker {
  private nextId = 1;
  private readonly pending = new Map<number, (r: VisionResult) => void>();

  private constructor(
    private readonly worker: Worker,
    public readonly delegate: 'GPU' | 'CPU',
  ) {
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type !== 'result') return;
      this.pending.get(msg.id)?.(msg.result);
      this.pending.delete(msg.id);
    };
  }

  static async create(task: WorkerTask, model: PoseModel): Promise<VisionWorker> {
    const worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
    try {
      const delegate = await new Promise<'GPU' | 'CPU'>((resolve, reject) => {
        // the worker downloads the model itself: allow for a slow connection
        const timer = setTimeout(
          () => reject(new Error(`vision worker (${task}): init timeout`)),
          60000,
        );
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
          task,
          model,
          sources: modelSources(model),
          numPoses: DEFAULT_PEOPLE,
        };
        worker.postMessage(init);
      });
      worker.onerror = null;
      return new VisionWorker(worker, delegate);
    } catch (err) {
      worker.terminate();
      throw err;
    }
  }

  run(
    ts: number,
    bitmaps: { frame?: ImageBitmap; hand?: ImageBitmap },
    thumb = false,
  ): Promise<VisionResult> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      const req: WorkerRequest = { type: 'detect', id, ts, thumb, ...bitmaps };
      this.worker.postMessage(
        req,
        [bitmaps.frame, bitmaps.hand].filter((b): b is ImageBitmap => !!b),
      );
    });
  }

  post(req: WorkerRequest): void {
    this.worker.postMessage(req);
  }

  close(): void {
    this.worker.terminate();
    this.pending.forEach((resolve) => resolve({ people: [], ms: 0 }));
    this.pending.clear();
  }
}

class WorkerTracker implements PoseTracker {
  readonly where = 'worker';
  readonly hands = true;
  /** the hand worker, once its model is loaded (it starts in the background) */
  private hand: VisionWorker | null = null;
  private closed = false;

  private constructor(
    private readonly pose: VisionWorker,
    public readonly model: PoseModel,
  ) {
    // the hand model loads in its own worker meanwhile: the camera screens do not wait for it
    VisionWorker.create('hand', model).then(
      (w) => (this.closed ? w.close() : (this.hand = w)),
      (err) => console.error('[pose] hand worker failed: no fist click / finger tracking', err),
    );
  }

  get delegate(): 'GPU' | 'CPU' {
    return this.pose.delegate;
  }

  static async create(model: PoseModel): Promise<WorkerTracker> {
    return new WorkerTracker(await VisionWorker.create('pose', model), model);
  }

  async detect(video: HTMLVideoElement, tMs: number, thumb = false): Promise<VisionResult> {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const k = Math.min(1, INPUT_HEIGHT / vh);
    const frame = await createImageBitmap(video, {
      resizeWidth: Math.round(vw * k),
      resizeHeight: Math.round(vh * k),
      resizeQuality: 'low',
    });
    return this.pose.run(tMs, { frame }, thumb);
  }

  async detectHand(video: HTMLVideoElement, tMs: number, roi: Roi): Promise<HandState | null> {
    if (!this.hand) return null;
    const crop = await createImageBitmap(
      video,
      Math.round(roi.x),
      Math.round(roi.y),
      Math.max(1, Math.round(roi.w)),
      Math.max(1, Math.round(roi.h)),
      { resizeWidth: HAND_CROP, resizeHeight: HAND_CROP, resizeQuality: 'medium' },
    );
    const res = await this.hand.run(tMs, { hand: crop });
    return res.hand ?? null;
  }

  setMaxPeople(n: number): void {
    this.pose.post({ type: 'config', numPoses: n });
  }

  close(): void {
    this.closed = true;
    this.pose.close();
    this.hand?.close();
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

  private thumbCtx: CanvasRenderingContext2D | null = null;

  detect(video: HTMLVideoElement, tMs: number, thumb = false): Promise<VisionResult> {
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
      thumb: thumb ? this.thumbnail(video) : undefined,
    });
  }

  /** no worker: the thumbnail has to be read on the main thread */
  private thumbnail(video: HTMLVideoElement): Uint8ClampedArray | undefined {
    try {
      this.thumbCtx ??= Object.assign(document.createElement('canvas'), {
        width: THUMB_W,
        height: THUMB_H,
      }).getContext('2d', { willReadFrequently: true });
      if (!this.thumbCtx) return undefined;
      this.thumbCtx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
      return this.thumbCtx.getImageData(0, 0, THUMB_W, THUMB_H).data;
    } catch {
      return undefined;
    }
  }

  setMaxPeople(n: number): void {
    void this.landmarker.setOptions({ numPoses: n });
  }

  close(): void {
    this.landmarker.close();
  }
}

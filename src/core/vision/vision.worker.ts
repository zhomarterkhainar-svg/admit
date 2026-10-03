// Runs MediaPipe off the main thread: the UI (hand cursor, HUD, animations) never waits for the
// neural network. Frames arrive as downscaled ImageBitmaps (zero-copy transfer); the pose model
// runs on every frame, the hand model only on a small crop around the cursor hand when asked.
import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { handOpenness } from '@/gestures/grab';
import type { Landmark } from '../types';
import type {
  HandState,
  ModelSource,
  RawPerson,
  WorkerRequest,
  WorkerResponse,
} from './visionTypes';

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(msg: WorkerResponse): void;
};

type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let pose: PoseLandmarker | null = null;
let hand: HandLandmarker | null = null;
let handState: 'none' | 'loading' | 'ready' | 'failed' = 'none';
let fileset: Fileset | null = null;
let source: ModelSource | null = null;
let delegate: 'GPU' | 'CPU' = 'GPU';
let lastTs = -1;
let lastHandTs = -1;

const toLm = (l: NormalizedLandmark): Landmark => ({
  x: l.x,
  y: l.y,
  z: l.z,
  visibility: l.visibility ?? 1,
});

async function init(req: Extract<WorkerRequest, { type: 'init' }>): Promise<void> {
  let lastError: unknown = null;
  for (const src of req.sources) {
    try {
      // `true`: the ES-module build of the wasm loader (importScripts is not allowed in module workers)
      fileset = await FilesetResolver.forVisionTasks(src.wasm, true);
    } catch (err) {
      lastError = err;
      continue;
    }
    for (const d of ['GPU', 'CPU'] as const) {
      try {
        pose = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: src.pose, delegate: d },
          runningMode: 'VIDEO',
          numPoses: req.numPoses,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        source = src;
        delegate = d;
        scope.postMessage({ type: 'ready', delegate: d });
        return;
      } catch (err) {
        lastError = err;
      }
    }
  }
  scope.postMessage({ type: 'error', message: String(lastError) });
}

/** The hand model is loaded lazily, the first time the cursor needs it. */
async function loadHand(): Promise<void> {
  if (!fileset || !source || handState !== 'none') return;
  handState = 'loading';
  for (const d of [delegate, 'CPU'] as const) {
    try {
      hand = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: source.hand, delegate: d },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
      handState = 'ready';
      return;
    } catch (err) {
      console.warn('[vision worker] hand model failed', d, err);
    }
  }
  handState = 'failed';
}

function detectHand(bitmap: ImageBitmap, ts: number): HandState | null {
  if (!hand) return null;
  const t = ts <= lastHandTs ? lastHandTs + 1 : ts;
  lastHandTs = t;
  const res = hand.detectForVideo(bitmap, t);
  const lms = res.worldLandmarks[0];
  if (!lms) return null;
  return {
    openness: handOpenness(lms),
    score: res.handedness[0]?.[0]?.score ?? 1,
    points: (res.landmarks[0] ?? []).map((p) => ({ x: p.x, y: p.y })),
  };
}

scope.onmessage = (e) => {
  const req = e.data;
  if (req.type === 'init') {
    void init(req);
    return;
  }
  if (req.type === 'config') {
    void pose?.setOptions({ numPoses: req.numPoses });
    return;
  }
  const t0 = performance.now();
  let people: RawPerson[] = [];
  let handResult: HandState | null | undefined;
  try {
    if (pose) {
      const ts = req.ts <= lastTs ? lastTs + 1 : req.ts;
      lastTs = ts;
      const res = pose.detectForVideo(req.frame, ts);
      people = res.landmarks.map((lms, i) => ({
        image: lms.map(toLm),
        world: (res.worldLandmarks[i] ?? []).map(toLm),
      }));
    }
    if (req.hand) {
      if (handState === 'none') void loadHand();
      handResult = handState === 'ready' ? detectHand(req.hand, req.ts) : null;
    }
  } catch (err) {
    console.warn('[vision worker]', err);
  } finally {
    req.frame.close();
    req.hand?.close();
  }
  scope.postMessage({
    type: 'result',
    id: req.id,
    result: { people, hand: handResult, ms: performance.now() - t0 },
  });
};

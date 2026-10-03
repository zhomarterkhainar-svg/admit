import { LandmarkSmoother } from '../filters/landmarkSmoother';
import { extractFeatures } from '../features/extract';
import { P, type FrameFeatures, type PoseFrame } from '../types';
import type { PoseTracker } from './poseTracker';
import type { HandState, Roi, VisionResult } from './visionTypes';
import { PersonLock, torsoColor, type Rgb } from './personLock';

export interface PoseTick {
  /** ms, performance.now() */
  t: number;
  frame: PoseFrame | null;
  features: FrameFeatures | null;
  /** everyone detected in the frame, including passers-by */
  people: number;
  /** people in frame who are NOT the locked player (ignored by everything downstream) */
  others?: number;
  /** everyone in the frame, raw (unsmoothed, unordered) — for two-player modes */
  crowd?: PoseFrame[];
  /** inference frames per second (EMA) */
  fps: number;
  /** last inference time, ms */
  inferenceMs: number;
  /** mean frame luminance 0..1 (sampled ~2×/s), for the "too dark" hint */
  brightness?: number;
  /**
   * The cursor hand seen close up (only while `trackHand` asks for it): undefined = not measured
   * this frame, null = looked but no hand found.
   */
  hand?: HandState | null;
}

export type PoseListener = (tick: PoseTick) => void;

/** Anything that emits pose ticks: the live camera loop or the scripted demo actor. */
export interface PoseSource {
  subscribe(fn: PoseListener): () => void;
  /** forget the followed person and lock onto whoever stands in front now (camera only) */
  resetLock?(): void;
  /** measure this hand of the player close up (open palm / fist) until set back to null */
  trackHand?(side: 'l' | 'r' | null): void;
  /** look for up to this many people (default 1; the duel needs 2) */
  setMaxPeople?(n: number): void;
}

/**
 * A square around the player's hand, in video px, from the pose landmarks: centred on the palm
 * (wrist, index and pinky knuckles), big enough for spread fingers at any angle.
 */
export function handRoi(frame: PoseFrame, side: 'l' | 'r'): Roi | null {
  const im = frame.image;
  const { width: vw, height: vh } = frame;
  const w = im[side === 'l' ? P.leftWrist : P.rightWrist]!;
  const e = im[side === 'l' ? P.leftElbow : P.rightElbow]!;
  const i = im[side === 'l' ? P.leftIndex : P.rightIndex]!;
  const k = im[side === 'l' ? P.leftPinky : P.rightPinky]!;
  const ls = im[P.leftShoulder]!;
  const rs = im[P.rightShoulder]!;
  if (w.visibility < 0.4) return null;
  const cx = ((w.x + i.x + k.x) / 3) * vw;
  const cy = ((w.y + i.y + k.y) / 3) * vh;
  const forearm = e.visibility > 0.4 ? Math.hypot((w.x - e.x) * vw, (w.y - e.y) * vh) : 0;
  const shoulders = Math.hypot((ls.x - rs.x) * vw, (ls.y - rs.y) * vh);
  const size = Math.min(Math.max(1.3 * forearm, 0.6 * shoulders, 72), 0.7 * vh);
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

/** Hand landmarks from crop-normalized to video-normalized coordinates (the crop is `roi`, video px). */
export function cropToVideo(
  points: readonly { x: number; y: number }[],
  roi: Roi,
  vw: number,
  vh: number,
): { x: number; y: number }[] {
  return points.map((p) => ({ x: (roi.x + p.x * roi.w) / vw, y: (roi.y + p.y * roi.h) / vh }));
}

type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/**
 * Drives detection on new video frames, smooths landmarks and extracts features.
 * Consumers subscribe; one loop feeds renderer, exercises, gestures and UI.
 * Detection is asynchronous (a worker): while a frame is being processed newer camera frames are
 * skipped, so the loop runs as fast as the model allows and never queues up latency.
 */
export class PoseLoop implements PoseSource {
  private readonly listeners = new Set<PoseListener>();
  private readonly smoothImage = new LandmarkSmoother();
  private readonly smoothWorld = new LandmarkSmoother();
  private running = false;
  private handle = 0;
  private fps = 0;
  private lastT = 0;
  private brightness: number | undefined;
  private lastBrightnessT = 0;
  private probe: CanvasRenderingContext2D | null = null;
  private colorProbe: CanvasRenderingContext2D | null = null;
  private lastColorT = 0;
  private readonly lock = new PersonLock();
  private busy = false;
  private busySince = 0;
  private handSide: 'l' | 'r' | null = null;
  private lastFrame: PoseFrame | null = null;
  private maxPeople = 1;

  constructor(
    private readonly video: VideoWithRVFC,
    private tracker: PoseTracker,
  ) {}

  /** Hot-swap the model (e.g. full → lite on slow devices). */
  setTracker(tracker: PoseTracker): void {
    this.tracker = tracker;
    this.fps = 0;
    if (this.maxPeople !== 1) tracker.setMaxPeople(this.maxPeople);
  }

  setMaxPeople(n: number): void {
    if (n === this.maxPeople) return;
    this.maxPeople = n;
    this.tracker.setMaxPeople(n);
  }

  get currentTracker(): PoseTracker {
    return this.tracker;
  }

  /** Average luminance of a tiny downscaled copy of the frame. */
  private measureBrightness(now: number): void {
    if (now - this.lastBrightnessT < 500) return;
    this.lastBrightnessT = now;
    try {
      this.probe ??= Object.assign(document.createElement('canvas'), {
        width: 32,
        height: 18,
      }).getContext('2d', {
        willReadFrequently: true,
      });
      if (!this.probe) return;
      this.probe.drawImage(this.video, 0, 0, 32, 18);
      const d = this.probe.getImageData(0, 0, 32, 18).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4)
        sum += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
      this.brightness = sum / (d.length / 4) / 255;
    } catch {
      this.brightness = undefined;
    }
  }

  resetLock(): void {
    this.lock.reset();
  }

  trackHand(side: 'l' | 'r' | null): void {
    this.handSide = side;
  }

  /**
   * Clothing colour of each person's torso, for telling people apart. Sampled whenever there is
   * more than one person, and a few times a second otherwise to keep the player's colour fresh.
   */
  private torsoColors(people: PoseFrame[], now: number): (Rgb | null)[] | null {
    if (people.length === 0 || (people.length === 1 && now - this.lastColorT < 300)) return null;
    this.lastColorT = now;
    const W = 96;
    const H = 54;
    try {
      this.colorProbe ??= Object.assign(document.createElement('canvas'), {
        width: W,
        height: H,
      }).getContext('2d', { willReadFrequently: true });
      if (!this.colorProbe) return null;
      this.colorProbe.drawImage(this.video, 0, 0, W, H);
      const px = this.colorProbe.getImageData(0, 0, W, H).data;
      return people.map((p) => torsoColor(p.image, px, W, H));
    } catch {
      return null;
    }
  }

  subscribe(fn: PoseListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  stop(): void {
    this.running = false;
    if (this.video.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.handle);
    else cancelAnimationFrame(this.handle);
  }

  private schedule(): void {
    if (!this.running) return;
    const next = () => this.step();
    this.handle = this.video.requestVideoFrameCallback
      ? this.video.requestVideoFrameCallback(next)
      : requestAnimationFrame(next);
  }

  private step(): void {
    if (!this.running) return;
    const now = performance.now();
    const ready =
      this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.video.videoWidth > 0;
    // a lost reply (should never happen) must not stall the loop forever
    if (ready && (!this.busy || now - this.busySince > 3000)) {
      this.busy = true;
      this.busySince = now;
      const tracker = this.tracker;
      const roi =
        this.handSide && tracker.hands && this.lastFrame
          ? handRoi(this.lastFrame, this.handSide)
          : null;
      tracker.detect(this.video, now, roi).then(
        (res) => {
          this.busy = false;
          // a result from a model that was swapped out meanwhile is dropped
          if (this.running && tracker === this.tracker) this.process(res, now, roi);
        },
        (err) => {
          this.busy = false;
          console.warn('[pose] detect failed', err);
        },
      );
    }
    this.schedule();
  }

  private process(res: VisionResult, now: number, roi: Roi | null = null): void {
    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    const all: PoseFrame[] = res.people.map((p) => ({ t: now, ...p, width, height }));
    // follow the player only: passers-by never reach the smoother, features or gestures
    const colors = this.torsoColors(all, now);
    const idx = this.lock.pick(
      all.map((p, i) => ({ image: p.image, color: colors?.[i] ?? null })),
      now,
      width / height,
    );
    const raw = idx >= 0 ? all[idx]! : null;
    const people = all.length;
    this.measureBrightness(now);
    if (this.lastT) this.fps = 0.9 * this.fps + 0.1 * (1000 / Math.max(now - this.lastT, 1));
    this.lastT = now;

    let frame: PoseFrame | null = null;
    let features: FrameFeatures | null = null;
    if (raw) {
      frame = {
        ...raw,
        image: this.smoothImage.smooth(raw.image, now),
        world: this.smoothWorld.smooth(raw.world, now),
      };
      features = extractFeatures(frame);
    } else {
      this.smoothImage.reset();
      this.smoothWorld.reset();
    }
    this.lastFrame = frame;
    const tick: PoseTick = {
      t: now,
      frame,
      features,
      people,
      others: people - (raw ? 1 : 0),
      crowd: all,
      fps: this.fps,
      inferenceMs: res.ms,
      brightness: this.brightness,
      hand:
        res.hand?.points && roi
          ? { ...res.hand, points: cropToVideo(res.hand.points, roi, width, height) }
          : res.hand && { ...res.hand, points: undefined },
    };
    this.listeners.forEach((fn) => fn(tick));
  }
}

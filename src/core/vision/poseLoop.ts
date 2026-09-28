import { LandmarkSmoother } from '../filters/landmarkSmoother';
import { extractFeatures } from '../features/extract';
import type { FrameFeatures, PoseFrame } from '../types';
import type { PoseTracker } from './poseTracker';

export interface PoseTick {
  /** ms, performance.now() */
  t: number;
  frame: PoseFrame | null;
  features: FrameFeatures | null;
  people: number;
  /** inference frames per second (EMA) */
  fps: number;
  /** last inference time, ms */
  inferenceMs: number;
}

export type PoseListener = (tick: PoseTick) => void;

/** Anything that emits pose ticks: the live camera loop or the scripted demo actor. */
export interface PoseSource {
  subscribe(fn: PoseListener): () => void;
}

type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/**
 * Drives detection once per new video frame, smooths landmarks and extracts features.
 * Consumers subscribe; one loop feeds renderer, exercises, gestures and UI.
 */
export class PoseLoop implements PoseSource {
  private readonly listeners = new Set<PoseListener>();
  private readonly smoothImage = new LandmarkSmoother();
  private readonly smoothWorld = new LandmarkSmoother();
  private running = false;
  private handle = 0;
  private fps = 0;
  private lastT = 0;

  constructor(
    private readonly video: VideoWithRVFC,
    private readonly tracker: PoseTracker,
  ) {}

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
    if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && this.video.videoWidth > 0) {
      const t0 = performance.now();
      const { frame: raw, people } = this.tracker.detect(this.video, now);
      const inferenceMs = performance.now() - t0;
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
      const tick: PoseTick = { t: now, frame, features, people, fps: this.fps, inferenceMs };
      this.listeners.forEach((fn) => fn(tick));
    }
    this.schedule();
  }
}

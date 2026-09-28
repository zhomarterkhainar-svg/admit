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
  /** mean frame luminance 0..1 (sampled ~2×/s), for the "too dark" hint */
  brightness?: number;
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
  private brightness: number | undefined;
  private lastBrightnessT = 0;
  private probe: CanvasRenderingContext2D | null = null;

  constructor(
    private readonly video: VideoWithRVFC,
    private tracker: PoseTracker,
  ) {}

  /** Hot-swap the model (e.g. full → lite on slow devices). */
  setTracker(tracker: PoseTracker): void {
    this.tracker = tracker;
    this.fps = 0;
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
      const tick: PoseTick = {
        t: now,
        frame,
        features,
        people,
        fps: this.fps,
        inferenceMs,
        brightness: this.brightness,
      };
      this.listeners.forEach((fn) => fn(tick));
    }
    this.schedule();
  }
}

import { useEffect, useMemo, useRef } from 'react';
import { Lightbulb } from 'lucide-react';
import { POSE_CONNECTIONS, type PoseFrame } from '@/core/types';
import { t, type I18nKey } from '@/i18n';
import { ALL_EXERCISES } from '@/exercises/registry';
import { extractFeatures } from '@/core/features/extract';
import type { Replay } from '@/game/replay';
import { drawSkeleton } from '../overlay/drawSkeleton';
import { drawGhost } from '../overlay/drawGhost';
import { fitCanvas, watchVisible } from '../overlay/canvasSize';

export const REPLAY_SPEED = 0.35;
const PEAK_PAUSE_MS = 700;
const END_PAUSE_MS = 500;
const JOINTS = [...new Set(POSE_CONNECTIONS.flat())];

interface Props {
  replay: Replay;
  message: I18nKey;
  fix: I18nKey;
  joints: readonly number[];
  /** show what went wrong under the picture (off when the text next to it already says it) */
  caption?: boolean;
}

/**
 * The worst rep of the set, replayed as a skeleton at ×0.35: the joints the error is about are
 * red, and at the deepest point it pauses and shows the correct pose as a ghost. No video is
 * recorded — only the pose landmarks already used for coaching.
 */
export function ErrorReplay({ replay, message, fix, joints, caption = true }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const exercise = ALL_EXERCISES[replay.exercise];
  const errorJoints = useMemo(() => new Set(joints), [joints]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const frames = replay.frames;
    const t0 = frames[0]!.t;
    const clipMs = Math.max(frames.at(-1)!.t - t0, 1);
    const peakT = frames[replay.peakIndex]!.t - t0;
    // one loop: slow play up to the peak, a pause there, slow play to the end, a short pause
    const slow = (ms: number) => ms / REPLAY_SPEED;
    const loopMs = slow(clipMs) + PEAK_PAUSE_MS + END_PAUSE_MS;
    const box = bounds(frames);
    let visible = true;
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      const w = canvas.width;
      const h = canvas.height;
      const tl = (now - start) % loopMs;
      // clip time for this moment of the loop
      let clipT: number;
      let atPeak = false;
      if (tl < slow(peakT)) clipT = tl * REPLAY_SPEED;
      else if (tl < slow(peakT) + PEAK_PAUSE_MS) {
        clipT = peakT;
        atPeak = true;
      } else clipT = Math.min(clipMs, (tl - PEAK_PAUSE_MS) * REPLAY_SPEED);
      let i = 0;
      while (i + 1 < frames.length && frames[i + 1]!.t - t0 <= clipT) i++;
      const frame = fit(frames[i]!, box, w, h);

      ctx.clearRect(0, 0, w, h);
      if (atPeak) {
        const f = extractFeatures(frames[i]!);
        const target = exercise.ghostFor?.(f) ?? exercise.keyframes.peak;
        drawGhost(ctx, frame, target, now, exercise.posture === 'floor');
      }
      drawSkeleton(ctx, frame, { errorJoints, lineWidth: 8, head: true, now });
      // progress line along the bottom
      ctx.fillStyle = 'rgba(28, 176, 246, 0.5)';
      ctx.fillRect(0, h - 4, (clipT / clipMs) * w, 4);
    };
    const unfit = fitCanvas(canvas);
    const unwatch = watchVisible(canvas, (v) => (visible = v));
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      unfit();
      unwatch();
    };
  }, [replay, exercise, errorJoints]);

  return (
    <div className="err-replay">
      <div className="err-replay-stage">
        <canvas ref={ref} aria-hidden="true" />
        <span className="err-replay-badge num">×{REPLAY_SPEED}</span>
      </div>
      {caption && (
        <div className="err-replay-text">
          <b>{t(message)}</b>
          <span className="fix">
            <Lightbulb size={15} strokeWidth={2.75} /> {t(fix)}
          </span>
        </div>
      )}
    </div>
  );
}

type Box = { minX: number; maxX: number; minY: number; maxY: number; aspect: number };

/** Bounding box of every visible joint of the clip, in aspect-corrected image units. */
function bounds(frames: PoseFrame[]): Box {
  const aspect = frames[0]!.width / frames[0]!.height;
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, aspect };
  for (const f of frames)
    for (const j of JOINTS) {
      const l = f.image[j]!;
      if (l.visibility < 0.5) continue;
      box.minX = Math.min(box.minX, l.x * aspect);
      box.maxX = Math.max(box.maxX, l.x * aspect);
      box.minY = Math.min(box.minY, l.y);
      box.maxY = Math.max(box.maxY, l.y);
    }
  // the head circle is drawn above the nose
  box.minY -= 0.08;
  return box;
}

/**
 * The frame re-projected so the clip's bounding box fills the canvas: a PoseFrame whose size is
 * the canvas, so drawSkeleton / drawGhost work unchanged.
 */
function fit(frame: PoseFrame, b: Box, w: number, h: number): PoseFrame {
  const bw = Math.max(b.maxX - b.minX, 1e-3);
  const bh = Math.max(b.maxY - b.minY, 1e-3);
  const s = 0.86 * Math.min(w / bw, h / bh); // px per image unit
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return {
    ...frame,
    width: w,
    height: h,
    // drawSkeleton mirrors x (selfie view) — keep the camera's orientation here
    image: frame.image.map((l) => ({
      ...l,
      x: (w / 2 + (l.x * b.aspect - cx) * s) / w,
      y: (h / 2 + (l.y - cy) * s) / h,
    })),
  };
}

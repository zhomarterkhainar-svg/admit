import { useEffect, useRef } from 'react';
import { blend, makePose } from '@/core/reference/template';
import type { PoseFrame } from '@/core/types';
import type { ExerciseDefinition } from '@/engine/types';
import { drawSkeleton } from './drawSkeleton';
import { fitCanvas, watchVisible } from './canvasSize';

/** Fixed frame for the whole animation: fits the union of rest/peak poses into the canvas. */
const STANDING_BOX = { minX: -0.62, maxX: 0.62, minY: -1.2, maxY: 0.95 };
type Box = typeof STANDING_BOX;

/** Floor exercises lie sideways: frame their own keyframes (with a margin) instead. */
function boxFor(keyframes: ExerciseDefinition<unknown>['keyframes']): Box {
  const pts = [keyframes.rest, keyframes.peak, keyframes.peakAlt ?? {}].flatMap(
    (e) => makePose(e).world,
  );
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const m = 0.15;
  return {
    minX: Math.min(...xs) - m,
    maxX: Math.max(...xs) + m,
    minY: Math.min(...ys) - m,
    maxY: Math.max(...ys) + m,
  };
}

export function fitFrame(
  world: PoseFrame['world'],
  w: number,
  h: number,
  box: Box = STANDING_BOX,
): PoseFrame {
  const bw = box.maxX - box.minX;
  const bh = box.maxY - box.minY;
  const k = 0.92 * Math.min(w / bw, h / bh); // px per meter
  const cx = w / 2 - ((box.minX + box.maxX) / 2) * k;
  const cy = h / 2 - ((box.minY + box.maxY) / 2) * k;
  return {
    t: 0,
    width: w,
    height: h,
    world,
    image: world.map((p) => ({
      x: (cx + p.x * k) / w,
      y: (cy + p.y * k) / h,
      z: p.z,
      visibility: 1,
    })),
  };
}

/**
 * Animated reference skeleton ("ghost coach") showing how the exercise is done.
 * Alternates sides for exercises with `peakAlt` (lunges, side bends).
 */
export function GhostPreview<M>({
  exercise,
  periodMs = 2200,
}: {
  exercise: ExerciseDefinition<M>;
  periodMs?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let visible = true;
    let lastDraw = 0;
    const start = performance.now();
    const box = exercise.posture === 'floor' ? boxFor(exercise.keyframes) : STANDING_BOX;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      // a slow 2 s loop looks the same at 30 fps; nothing to draw while scrolled away or hidden
      if (!visible || document.hidden || now - lastDraw < 32) return;
      lastDraw = now;
      const cycle = (now - start) / periodMs;
      const k = (1 - Math.cos(2 * Math.PI * cycle)) / 2;
      const { rest, peak, peakAlt } = exercise.keyframes;
      const target = peakAlt && Math.floor(cycle) % 2 === 1 ? peakAlt : peak;
      const world = makePose(blend(rest, target, k)).world;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawSkeleton(ctx, fitFrame(world, canvas.width, canvas.height, box), {
        color: '#1cb0f6',
        lineWidth: 9,
        head: true,
      });
    };
    const unfit = fitCanvas(canvas, () => (lastDraw = 0));
    const unwatch = watchVisible(canvas, (v) => (visible = v));
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      unfit();
      unwatch();
    };
  }, [exercise, periodMs]);
  // the wrapper takes the layout size; the canvas just fills it (see fitCanvas)
  return (
    <div className="ghost-preview">
      <canvas ref={ref} />
    </div>
  );
}

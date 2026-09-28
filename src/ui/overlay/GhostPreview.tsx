import { useEffect, useRef } from 'react';
import { blend, makePose } from '@/core/reference/template';
import type { PoseFrame } from '@/core/types';
import type { ExerciseDefinition } from '@/engine/types';
import { drawSkeleton } from './drawSkeleton';

/** Fixed frame for the whole animation: fits the union of rest/peak poses into the canvas. */
const BOX = { minX: -0.62, maxX: 0.62, minY: -1.2, maxY: 0.95 };

export function fitFrame(world: PoseFrame['world'], w: number, h: number): PoseFrame {
  const bw = BOX.maxX - BOX.minX;
  const bh = BOX.maxY - BOX.minY;
  const k = 0.92 * Math.min(w / bw, h / bh); // px per meter
  const cx = w / 2;
  const cy = h / 2 - ((BOX.minY + BOX.maxY) / 2) * k;
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
    const start = performance.now();
    const draw = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== canvas.clientWidth * dpr) {
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
      }
      const cycle = (now - start) / periodMs;
      const k = (1 - Math.cos(2 * Math.PI * cycle)) / 2;
      const { rest, peak, peakAlt } = exercise.keyframes;
      const target = peakAlt && Math.floor(cycle) % 2 === 1 ? peakAlt : peak;
      const world = makePose(blend(rest, target, k)).world;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawSkeleton(ctx, fitFrame(world, canvas.width, canvas.height), {
        color: '#ffc72c',
        lineWidth: 9,
        head: true,
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [exercise, periodMs]);
  return <canvas ref={ref} className="ghost-preview" />;
}

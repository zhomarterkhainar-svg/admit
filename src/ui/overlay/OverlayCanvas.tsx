import { useEffect, useRef } from 'react';
import type { PoseSource, PoseTick } from '@/core/vision/poseLoop';
import { drawSkeleton } from './drawSkeleton';

export interface OverlayProps {
  loop: PoseSource;
  /** extra drawing after the skeleton (ghost, arrows, cursor, particles) */
  onDraw?: (ctx: CanvasRenderingContext2D, tick: PoseTick) => void;
  errorJoints?: ReadonlySet<number>;
}

/** Full-screen canvas synced to the pose loop. Resizes to its CSS box with devicePixelRatio. */
export function OverlayCanvas({ loop, onDraw, errorJoints }: OverlayProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const errRef = useRef(errorJoints);
  const drawRef = useRef(onDraw);
  useEffect(() => {
    errRef.current = errorJoints;
    drawRef.current = onDraw;
  });

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const unsub = loop.subscribe((tick) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (tick.frame) drawSkeleton(ctx, tick.frame, { errorJoints: errRef.current });
      drawRef.current?.(ctx, tick);
    });
    return () => {
      unsub();
      ro.disconnect();
    };
  }, [loop]);

  return <canvas ref={ref} className="overlay" />;
}

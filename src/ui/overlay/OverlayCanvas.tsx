import { useEffect, useRef } from 'react';
import type { PoseSource, PoseTick } from '@/core/vision/poseLoop';
import { drawSkeleton } from './drawSkeleton';
import { fitCanvas } from './canvasSize';

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
    const unfit = fitCanvas(canvas);
    const unsub = loop.subscribe((tick) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (tick.frame) drawSkeleton(ctx, tick.frame, { errorJoints: errRef.current });
      drawRef.current?.(ctx, tick);
    });
    return () => {
      unsub();
      unfit();
    };
  }, [loop]);

  return <canvas ref={ref} className="overlay" />;
}

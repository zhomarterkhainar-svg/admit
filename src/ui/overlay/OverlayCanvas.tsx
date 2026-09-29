import { useEffect, useRef } from 'react';
import type { PoseSource, PoseTick } from '@/core/vision/poseLoop';
import { drawSkeleton } from './drawSkeleton';
import { fitCanvas } from './canvasSize';

export interface OverlayProps {
  loop: PoseSource;
  /** extra drawing after the skeleton (ghost, arrows, cursor, particles) */
  onDraw?: (ctx: CanvasRenderingContext2D, tick: PoseTick) => void;
  errorJoints?: ReadonlySet<number>;
  /** false: don't draw the player's skeleton (two-player modes draw their own in onDraw) */
  skeleton?: boolean;
}

/** Full-screen canvas synced to the pose loop. Resizes to its CSS box with devicePixelRatio. */
export function OverlayCanvas({ loop, onDraw, errorJoints, skeleton = true }: OverlayProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const errRef = useRef(errorJoints);
  const drawRef = useRef(onDraw);
  const skelRef = useRef(skeleton);
  useEffect(() => {
    errRef.current = errorJoints;
    drawRef.current = onDraw;
    skelRef.current = skeleton;
  });

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const unfit = fitCanvas(canvas);
    const unsub = loop.subscribe((tick) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (tick.frame && skelRef.current)
        drawSkeleton(ctx, tick.frame, { errorJoints: errRef.current });
      drawRef.current?.(ctx, tick);
    });
    return () => {
      unsub();
      unfit();
    };
  }, [loop]);

  return <canvas ref={ref} className="overlay" />;
}

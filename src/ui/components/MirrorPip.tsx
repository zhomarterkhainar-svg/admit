import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { useLoop, useVideo } from '../engine';
import { drawSkeleton } from '../overlay/drawSkeleton';

/**
 * Small live "mirror" (camera + skeleton) for the light menu screens, so the user always sees
 * that the camera tracks them while they steer the hand cursor. In demo mode it shows the
 * virtual athlete's skeleton on a light stage.
 */
export function MirrorPip({ className = '' }: { className?: string }) {
  const loop = useLoop();
  const videoRef = useVideo();
  const ref = useRef<HTMLCanvasElement>(null);
  const pip = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);

  // the camera picture is a second <video> on the same stream: the browser composites it on the
  // GPU. Copying every frame into the canvas from JS cost several ms a frame on the main thread.
  useEffect(() => {
    const src = videoRef?.current?.srcObject;
    const v = pip.current;
    if (!v || !(src instanceof MediaStream)) return setLive(false);
    v.srcObject = src;
    void v.play().catch(() => {});
    setLive(true);
    return () => {
      v.srcObject = null;
    };
  }, [videoRef, loop]);

  // only the skeleton is drawn per pose tick, on a transparent canvas over the video
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    return loop.subscribe((tick) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      if (tick.frame) drawSkeleton(ctx, tick.frame, { lineWidth: 10 });
    });
  }, [loop]);

  return (
    <figure className={`mirror ${live ? 'is-live' : ''} ${className}`}>
      <video ref={pip} muted playsInline autoPlay aria-hidden="true" />
      <canvas ref={ref} aria-hidden="true" />
      <figcaption>
        <span className="rec-dot" /> {t('mirror.label')}
      </figcaption>
    </figure>
  );
}

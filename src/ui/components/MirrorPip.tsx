import { useEffect, useRef } from 'react';
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
      const video = videoRef?.current;
      if (video && video.readyState >= 2 && video.videoWidth) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const s = Math.max(w / vw, h / vh);
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1); // selfie view, same as the full-screen camera
        ctx.drawImage(video, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);
        ctx.restore();
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#ddf4ff');
        g.addColorStop(1, '#f7fbff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      if (tick.frame) drawSkeleton(ctx, tick.frame, { lineWidth: 10 });
    });
  }, [loop, videoRef]);

  return (
    <figure className={`mirror ${className}`}>
      <canvas ref={ref} aria-hidden="true" />
      <figcaption>
        <span className="rec-dot" /> {t('mirror.label')}
      </figcaption>
    </figure>
  );
}

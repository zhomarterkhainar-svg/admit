import type { PoseFrame } from '@/core/types';
import type { Arrow } from '@/engine/types';
import { coverMapper } from './drawSkeleton';

/** Animated correction arrow next to a joint ("move knee outward", "hips down"). */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  arrow: Arrow,
  now = performance.now(),
): void {
  const lm = frame.image[arrow.joint];
  if (!lm || lm.visibility < 0.5) return;
  const { width: cw, height: ch } = ctx.canvas;
  const p = coverMapper(frame.width, frame.height, cw, ch, true).map(lm.x, lm.y);
  const s = Math.min(cw, ch) / 720;
  const len = 70 * s;
  const off = 20 * s + 10 * s * Math.sin(now / 150);
  const [dx, dy] = arrow.dir;
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;
  const x0 = p.x + ux * off;
  const y0 = p.y + uy * off;
  const x1 = x0 + ux * len;
  const y1 = y0 + uy * len;

  const h = 22 * s;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // dark outline first, then the gold arrow: readable on any camera background
  for (const [color, extra] of [
    ['rgba(60, 60, 60, 0.85)', 6 * s],
    ['#ffc800', 0],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 9 * s + extra;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1 + ux * h, y1 + uy * h);
    ctx.lineTo(x1 - uy * h * 0.8, y1 + ux * h * 0.8);
    ctx.lineTo(x1 + uy * h * 0.8, y1 - ux * h * 0.8);
    ctx.closePath();
    ctx.fill();
    if (extra) ctx.stroke();
  }
  ctx.restore();
}

import type { PoseFrame } from '@/core/types';
import type { Gauge } from '@/engine/types';
import { coverMapper } from './drawSkeleton';

const COLORS = { good: '#58cc02', warn: '#ff9600', none: '#1cb0f6' } as const;

/**
 * A protractor on a joint: a filled wedge between the two limbs meeting there and the angle in
 * degrees in a pill beside it (e.g. the elbow in a push-up: "92°", green once deep enough).
 */
export function drawGauge(ctx: CanvasRenderingContext2D, frame: PoseFrame, g: Gauge): void {
  const im = frame.image;
  const J = im[g.at];
  const F = im[g.from];
  const T = im[g.to];
  if (!J || !F || !T || Math.min(J.visibility, F.visibility, T.visibility) < 0.5) return;
  const { width: cw, height: ch } = ctx.canvas;
  const { map } = coverMapper(frame.width, frame.height, cw, ch, true);
  const j = map(J.x, J.y);
  const f = map(F.x, F.y);
  const t = map(T.x, T.y);
  const scale = Math.min(cw, ch) / 720;
  const len = Math.min(Math.hypot(f.x - j.x, f.y - j.y), Math.hypot(t.x - j.x, t.y - j.y));
  const r = Math.min(Math.max(0.45 * len, 22 * scale), 64 * scale);
  const a1 = Math.atan2(f.y - j.y, f.x - j.x);
  let d = Math.atan2(t.y - j.y, t.x - j.x) - a1;
  // the smaller of the two arcs between the limbs
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const color = COLORS[g.tone ?? 'none'];

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(j.x, j.y);
  ctx.arc(j.x, j.y, r, a1, a1 + d, d < 0);
  ctx.closePath();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(j.x, j.y, r, a1, a1 + d, d < 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5 * scale;
  ctx.lineCap = 'round';
  ctx.stroke();

  // the number sits on the far side of the joint, away from both limbs
  const mid = a1 + d / 2 + Math.PI;
  const label = `${Math.round(g.deg)}°`;
  const fs = Math.round(26 * scale);
  ctx.font = `900 ${fs}px Nunito Variable, Nunito, system-ui, sans-serif`;
  const w = ctx.measureText(label).width + 18 * scale;
  const h = fs + 10 * scale;
  const cx = j.x + Math.cos(mid) * (r * 0.6 + w * 0.55);
  const cy = j.y + Math.sin(mid) * (r * 0.6 + h * 0.7);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 1);
  ctx.restore();
}

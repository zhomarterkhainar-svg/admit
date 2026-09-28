import { POSE_CONNECTIONS, type PoseFrame } from '@/core/types';

export interface SkeletonStyle {
  /** landmark indices to paint as errors (red, pulsing) */
  errorJoints?: ReadonlySet<number>;
  color?: string;
  errorColor?: string;
  /** 0..1, for ghost/reference skeleton */
  alpha?: number;
  lineWidth?: number;
  /** mirror horizontally (selfie view) */
  mirror?: boolean;
  /** ms timestamp for pulse animation */
  now?: number;
}

const MIN_VIS = 0.5;

/** Draws the pose onto a canvas that is laid over the video with object-fit: cover semantics. */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  {
    errorJoints = new Set(),
    color = '#2ee59d',
    errorColor = '#ff4d5e',
    alpha = 1,
    lineWidth = 6,
    mirror = true,
    now = performance.now(),
  }: SkeletonStyle = {},
): void {
  const { width: cw, height: ch } = ctx.canvas;
  const { map } = coverMapper(frame.width, frame.height, cw, ch, mirror);
  const pts = frame.image.map((l) => ({ ...map(l.x, l.y), v: l.visibility }));
  const pulse = 0.6 + 0.4 * Math.sin(now / 120);
  const scale = Math.min(cw, ch) / 720;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = pts[a]!;
    const pb = pts[b]!;
    if (pa.v < MIN_VIS || pb.v < MIN_VIS) continue;
    const bad = errorJoints.has(a) || errorJoints.has(b);
    ctx.strokeStyle = bad ? errorColor : color;
    ctx.lineWidth = lineWidth * scale * (bad ? 1 + 0.5 * pulse : 1);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  pts.forEach((p, i) => {
    if (i < 11 && i !== 0) return; // skip face details except nose
    if (p.v < MIN_VIS) return;
    const bad = errorJoints.has(i);
    ctx.fillStyle = bad ? errorColor : '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, (bad ? 10 + 6 * pulse : 6) * scale, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/**
 * Maps normalized video coords to canvas px when the video is rendered with object-fit: cover.
 * Shared by skeleton, ghost, arrows and the gesture cursor.
 */
export function coverMapper(vw: number, vh: number, cw: number, ch: number, mirror: boolean) {
  const s = Math.max(cw / vw, ch / vh);
  const dw = vw * s;
  const dh = vh * s;
  const ox = (cw - dw) / 2;
  const oy = (ch - dh) / 2;
  return {
    map: (x: number, y: number) => ({ x: ox + (mirror ? 1 - x : x) * dw, y: oy + y * dh }),
  };
}

import { makePose, type PoseEdit } from '@/core/reference/template';
import { P, type PoseFrame } from '@/core/types';
import { drawSkeleton } from './drawSkeleton';

const REF_SHOULDER_WIDTH = 0.38; // m, reference template

/**
 * Draws the reference ("correct") pose over the user so they see where their body should be.
 * Anchored at the feet (they barely move in our exercises) — or the hips if feet are hidden —
 * and scaled by shoulder width, which stays stable while squatting or bending.
 */
export function drawGhost(
  ctx: CanvasRenderingContext2D,
  user: PoseFrame,
  target: PoseEdit,
  now = performance.now(),
): void {
  const u = user.image;
  const ls = u[P.leftShoulder]!;
  const rs = u[P.rightShoulder]!;
  if (Math.min(ls.visibility, rs.visibility) < 0.5) return;
  const aspect = user.width / user.height;
  const k = Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y) / REF_SHOULDER_WIDTH; // image-height units per meter
  if (k <= 0) return;

  const ref = makePose(target).world;
  const la = u[P.leftAnkle]!;
  const ra = u[P.rightAnkle]!;
  const feetVisible = Math.min(la.visibility, ra.visibility) > 0.5;
  const [ua, ub, ra1, rb1] = feetVisible
    ? [la, ra, ref[P.leftAnkle]!, ref[P.rightAnkle]!]
    : [u[P.leftHip]!, u[P.rightHip]!, ref[P.leftHip]!, ref[P.rightHip]!];
  const anchorUser = { x: (ua.x + ub.x) / 2, y: (ua.y + ub.y) / 2 };
  const anchorRef = { x: (ra1.x + rb1.x) / 2, y: (ra1.y + rb1.y) / 2 };

  const ghost: PoseFrame = {
    ...user,
    image: ref.map((p) => ({
      x: anchorUser.x + ((p.x - anchorRef.x) * k) / aspect,
      y: anchorUser.y + (p.y - anchorRef.y) * k,
      z: p.z,
      visibility: 1,
    })),
  };
  const alpha = 0.35 + 0.1 * Math.sin(now / 300);
  drawSkeleton(ctx, ghost, { color: '#ffc72c', alpha, lineWidth: 10, head: true });
}

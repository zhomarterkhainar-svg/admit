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
  floor = false,
): void {
  if (floor) return drawFloorGhost(ctx, user, target, now);
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
  const alpha = 0.45 + 0.1 * Math.sin(now / 300);
  drawSkeleton(ctx, ghost, { color: '#1cb0f6', alpha, lineWidth: 10, head: true });
}

const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/**
 * Floor exercises (side view): shoulder width is ~0 from the side, so the ghost is scaled by
 * the torso length instead, turned to face the same way as the user (head left or right)
 * and anchored at the feet, which stay on the floor.
 */
function drawFloorGhost(
  ctx: CanvasRenderingContext2D,
  user: PoseFrame,
  target: PoseEdit,
  now: number,
): void {
  const u = user.image;
  const aspect = user.width / user.height;
  const uS = midpoint(u[P.leftShoulder]!, u[P.rightShoulder]!);
  const uH = midpoint(u[P.leftHip]!, u[P.rightHip]!);
  const ref = makePose(target).world;
  const rS = midpoint(ref[P.leftShoulder]!, ref[P.rightShoulder]!);
  const rH = midpoint(ref[P.leftHip]!, ref[P.rightHip]!);
  const uLen = Math.hypot((uS.x - uH.x) * aspect, uS.y - uH.y);
  const rLen = Math.hypot(rS.x - rH.x, rS.y - rH.y);
  if (uLen < 1e-3 || rLen < 1e-3) return;
  const k = uLen / rLen;
  // the reference lies with the head toward −x: mirror it if the user lies the other way
  const flip = Math.sign(uS.x - uH.x) !== Math.sign(rS.x - rH.x) ? -1 : 1;
  const feet = Math.min(u[P.leftAnkle]!.visibility, u[P.rightAnkle]!.visibility) > 0.5;
  const [ua, ra] = feet
    ? [midpoint(u[P.leftAnkle]!, u[P.rightAnkle]!), midpoint(ref[P.leftAnkle]!, ref[P.rightAnkle]!)]
    : [uH, rH];
  const ghost: PoseFrame = {
    ...user,
    image: ref.map((p) => ({
      x: ua.x + (flip * (p.x - ra.x) * k) / aspect,
      y: ua.y + (p.y - ra.y) * k,
      z: p.z,
      visibility: 1,
    })),
  };
  const alpha = 0.45 + 0.1 * Math.sin(now / 300);
  drawSkeleton(ctx, ghost, { color: '#1cb0f6', alpha, lineWidth: 10, head: true });
}

import { P, type PoseFrame } from '@/core/types';

export interface Cursor {
  /** normalized screen coords [0..1], already mirrored for the selfie view */
  x: number;
  y: number;
  hand: 'l' | 'r';
}

/**
 * Kinect-style "reach box": a comfortable box around the shoulders is mapped onto the whole screen,
 * so the user can reach every corner without stretching or walking.
 * The active hand is whichever index finger is raised higher (and above the hips).
 */
export function computeCursor(frame: PoseFrame, prev: Cursor | null): Cursor | null {
  const im = frame.image;
  const aspect = frame.width / frame.height;
  const ls = im[P.leftShoulder]!;
  const rs = im[P.rightShoulder]!;
  const lh = im[P.leftHip]!;
  const rh = im[P.rightHip]!;
  if (Math.min(ls.visibility, rs.visibility) < 0.5) return null;

  const shoulderMid = { x: ((ls.x + rs.x) / 2) * aspect, y: (ls.y + rs.y) / 2 };
  const hipY = (lh.y + rh.y) / 2;
  const torso = Math.max(hipY - shoulderMid.y, 0.05);
  const sw = Math.max(Math.abs(ls.x - rs.x) * aspect, 0.03);

  const candidates = (['l', 'r'] as const)
    .map((hand) => {
      const tip = im[hand === 'l' ? P.leftIndex : P.rightIndex]!;
      const wrist = im[hand === 'l' ? P.leftWrist : P.rightWrist]!;
      return { hand, tip, raised: wrist.visibility > 0.5 && wrist.y < hipY - 0.15 * torso };
    })
    .filter((c) => c.raised);
  if (!candidates.length) return null;

  // hysteresis: keep the previous hand while it is still raised
  const pick =
    candidates.find((c) => c.hand === prev?.hand) ??
    candidates.reduce((a, b) => (a.tip.y < b.tip.y ? a : b));

  const box = {
    left: shoulderMid.x - 1.7 * sw,
    right: shoulderMid.x + 1.7 * sw,
    top: shoulderMid.y - 1.1 * torso,
    bottom: shoulderMid.y + 0.8 * torso,
  };
  const nx = (pick.tip.x * aspect - box.left) / (box.right - box.left);
  const ny = (pick.tip.y - box.top) / (box.bottom - box.top);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return { x: clamp(1 - nx), y: clamp(ny), hand: pick.hand };
}

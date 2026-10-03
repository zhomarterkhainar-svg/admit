/** Bones of the 21-point MediaPipe hand: palm outline + each finger from its knuckle to the tip. */
export const HAND_BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4], // thumb
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8], // index
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12], // middle
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16], // ring
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20], // pinky + palm edge
];

/**
 * SVG path of the hand skeleton for the cursor icon: landmarks (video-normalized) are centred on
 * the palm, mirrored for the selfie view and scaled so the hand fits a `size`-px square.
 * Returns '' when there are no landmarks.
 */
export function fingerPath(
  points: readonly { x: number; y: number }[] | undefined,
  videoW: number,
  videoH: number,
  size = 56,
): string {
  if (!points || points.length < 21) return '';
  const px = points.map((p) => ({ x: -p.x * videoW, y: p.y * videoH })); // mirrored, in px
  const c = [0, 5, 9, 13, 17].reduce((a, i) => ({ x: a.x + px[i]!.x / 5, y: a.y + px[i]!.y / 5 }), {
    x: 0,
    y: 0,
  });
  // hand size = wrist → middle knuckle, which does not change when the fingers curl
  const span = Math.hypot(px[9]!.x - px[0]!.x, px[9]!.y - px[0]!.y) || 1;
  const k = (size * 0.26) / span;
  const f = (n: number) => n.toFixed(1);
  return HAND_BONES.map(([a, b]) => {
    const p = px[a]!;
    const q = px[b]!;
    return `M${f(size / 2 + (p.x - c.x) * k)} ${f(size / 2 + (p.y - c.y) * k)}L${f(size / 2 + (q.x - c.x) * k)} ${f(size / 2 + (q.y - c.y) * k)}`;
  }).join('');
}

import { describe, expect, it } from 'vitest';
import { makePose } from '@/core/reference/template';
import { P } from '@/core/types';
import { cropToVideo } from '@/core/vision/poseLoop';
import { computeCursor, palmCenter } from './cursor';
import { fingerPath, HAND_BONES } from './fingers';

/** synthetic 2D hand (crop-normalized): wrist at the bottom, fingers up; `curl` 0 = open … 1 = fist */
function hand(curl: number, ox = 0.5, oy = 0.5) {
  const pts: { x: number; y: number }[] = [{ x: ox, y: oy + 0.25 }]; // wrist
  const knuckleX = [-0.12, -0.08, 0, 0.08, 0.14]; // thumb, index, middle, ring, pinky
  for (let f = 0; f < 5; f++) {
    const kx = ox + knuckleX[f]!;
    const ky = oy + (f === 0 ? 0.1 : 0);
    pts.push({ x: kx, y: ky }); // knuckle: does not move when the finger curls
    for (let j = 1; j < 4; j++) {
      // open: the finger goes up; fist: it folds back down toward the palm
      pts.push({ x: kx, y: ky - j * 0.07 * (1 - curl) + j * 0.03 * curl });
    }
  }
  // MediaPipe order: 1-4 thumb, 5-8 index, ... (j=0 entry of each finger is its knuckle)
  return pts;
}

describe('finger tracking', () => {
  it('palm centre barely moves when the hand squeezes into a fist (no click drift)', () => {
    const open = palmCenter(hand(0))!;
    const fist = palmCenter(hand(1))!;
    expect(Math.hypot(open.x - fist.x, open.y - fist.y)).toBeLessThan(0.03);
    expect(palmCenter([])).toBeNull();
  });

  it('maps crop-normalized landmarks back to the video frame', () => {
    const roi = { x: 100, y: 50, w: 200, h: 200 };
    expect(
      cropToVideo(
        [
          { x: 0, y: 0 },
          { x: 0.5, y: 1 },
        ],
        roi,
        1000,
        500,
      ),
    ).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.5 },
    ]);
  });

  it('the cursor follows the palm from the hand model instead of the pose fingertip', () => {
    // right hand raised (person's right = image -x side)
    const frame = makePose({
      [P.rightElbow]: [-0.3, -0.35, -0.2],
      [P.rightWrist]: [-0.3, -0.6, -0.4],
      [P.rightIndex]: [-0.3, -0.66, -0.42],
    });
    const byPose = computeCursor(frame, null)!;
    const palm = {
      hand: 'r' as const,
      x: frame.image[P.rightWrist]!.x - 0.05,
      y: frame.image[P.rightWrist]!.y - 0.1,
    };
    const byFingers = computeCursor(frame, null, undefined, palm)!;
    expect(byFingers.hand).toBe('r');
    expect(byFingers.y).toBeLessThan(byPose.y); // palm higher → cursor higher
    expect(byFingers.x).toBeGreaterThan(byPose.x); // moved toward image -x → screen right (mirrored)
    // a palm of the other hand is ignored
    expect(computeCursor(frame, null, undefined, { ...palm, hand: 'l' })).toEqual(byPose);
  });

  it('draws one stroke per bone, and the fist is more compact than the open hand', () => {
    expect(fingerPath(undefined, 640, 480)).toBe('');
    const open = fingerPath(hand(0), 640, 480);
    const fist = fingerPath(hand(1), 640, 480);
    expect(open.match(/M/g)).toHaveLength(HAND_BONES.length);
    const ys = (d: string) => [...d.matchAll(/[ML][\d.-]+ ([\d.-]+)/g)].map((m) => Number(m[1]));
    const spread = (d: string) => Math.max(...ys(d)) - Math.min(...ys(d));
    expect(spread(fist)).toBeLessThan(spread(open));
  });
});

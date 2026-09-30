import { describe, expect, it } from 'vitest';
import { makePose } from '@/core/reference/template';
import { handRoi } from '@/core/vision/poseLoop';
import { P } from '@/core/types';
import { CLOSED_AT, GrabDetector, OPEN_AT, handOpenness } from './grab';

/**
 * A right hand in MediaPipe's 21-point layout: wrist at the origin, fingers pointing −y.
 * `curl` 0 = straight fingers, 1 = a fist (the joints bend toward the palm, −z, then back).
 */
function hand(curl: number) {
  const pts = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  for (let i = 1; i <= 4; i++) pts[i] = { x: 0.03 + 0.01 * i, y: -0.02 * i, z: 0 }; // thumb
  const bend = [80, 100, 60].map((deg) => (curl * deg * Math.PI) / 180);
  const lens = [0.035, 0.025, 0.02];
  [0.03, 0.01, -0.01, -0.03].forEach((x, f) => {
    const mcp = 5 + f * 4;
    let p = { x, y: -0.09, z: 0 };
    pts[mcp] = p;
    let angle = 0;
    for (let j = 0; j < 3; j++) {
      angle += bend[j]!;
      p = { x, y: p.y - Math.cos(angle) * lens[j]!, z: p.z - Math.sin(angle) * lens[j]! };
      pts[mcp + 1 + j] = p;
    }
  });
  return pts;
}

describe('fist detection', () => {
  it('open palm reads as open, a fist as closed', () => {
    expect(handOpenness(hand(0))).toBeGreaterThan(OPEN_AT);
    expect(handOpenness(hand(1))).toBeLessThan(CLOSED_AT);
  });

  it('does not depend on hand size or rotation', () => {
    const big = hand(0).map((p) => ({ x: p.x * 1.4, y: p.y * 1.4, z: p.z * 1.4 }));
    const turned = hand(1).map((p) => ({ x: p.y, y: -p.x, z: p.z }));
    expect(handOpenness(big)).toBeCloseTo(handOpenness(hand(0)), 5);
    expect(handOpenness(turned)).toBeCloseTo(handOpenness(hand(1)), 5);
  });

  const open = { openness: 2, score: 0.9 };
  const fist = { openness: 1, score: 0.9 };

  it('open → fist clicks once, holding the fist does not repeat', () => {
    const g = new GrabDetector();
    const out = [open, open, fist, fist, fist, fist, fist].map((h, i) => g.update(h, i * 40).grab);
    expect(out.filter(Boolean)).toHaveLength(1);
    expect(out[3]).toBe(true); // the second fist frame (one bad frame never clicks)
  });

  it('needs the hand to open again before the next click', () => {
    const g = new GrabDetector();
    const seq = [open, fist, fist, fist, open, open, fist, fist];
    const clicks = seq.map((h, i) => g.update(h, i * 40).grab).filter(Boolean);
    expect(clicks).toHaveLength(2);
  });

  it('a fist without an open hand first (e.g. the hand just appeared) does not click', () => {
    const g = new GrabDetector();
    const clicks = [fist, fist, fist, fist].map((h, i) => g.update(h, i * 40).grab);
    expect(clicks.some(Boolean)).toBe(false);
  });

  it('low-confidence or missing hands are ignored', () => {
    const g = new GrabDetector();
    g.update(open, 0);
    expect(g.update({ openness: 1, score: 0.2 }, 40).grab).toBe(false);
    expect(g.update(null, 80).grab).toBe(false);
    expect(g.update(fist, 120).grab).toBe(false);
    expect(g.update(fist, 160).grab).toBe(true);
  });
});

describe('hand crop', () => {
  it('is a square around the raised hand, inside a sensible size range', () => {
    const fr = makePose(
      {
        [P.rightElbow]: [-0.3, -0.35, -0.2],
        [P.rightWrist]: [-0.3, -0.6, -0.3],
        [P.rightIndex]: [-0.3, -0.68, -0.32],
      },
      0,
      1280,
      720,
    );
    const roi = handRoi(fr, 'r')!;
    expect(roi.w).toBe(roi.h);
    expect(roi.w).toBeGreaterThanOrEqual(72);
    expect(roi.w).toBeLessThanOrEqual(0.7 * 720);
    const wrist = fr.image[P.rightWrist]!;
    const wx = wrist.x * 1280;
    const wy = wrist.y * 720;
    expect(wx).toBeGreaterThan(roi.x);
    expect(wx).toBeLessThan(roi.x + roi.w);
    expect(wy).toBeGreaterThan(roi.y);
    expect(wy).toBeLessThan(roi.y + roi.h);
  });
});

describe('squeezeProgress', () => {
  it('0 for an open palm, 1 for a fist, monotonic in between', async () => {
    const { squeezeProgress, CLOSED_AT } = await import('./grab');
    expect(squeezeProgress(2.1)).toBe(0);
    expect(squeezeProgress(CLOSED_AT)).toBe(1);
    expect(squeezeProgress(1.6)).toBeGreaterThan(0.3);
    expect(squeezeProgress(1.6)).toBeLessThan(squeezeProgress(1.4));
    expect(squeezeProgress(undefined)).toBe(0);
  });
});

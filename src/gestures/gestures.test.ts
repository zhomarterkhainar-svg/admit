import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import { makePose, type PoseEdit } from '@/core/reference/template';
import { P } from '@/core/types';
import { HandCursor, computeCursor } from './cursor';
import { DwellTracker } from './dwell';
import { PoseGestureDetector, type PoseGesture } from './poseGestures';

function feed(det: PoseGestureDetector, edits: PoseEdit[], dt = 33): PoseGesture[] {
  const out: PoseGesture[] = [];
  edits.forEach((e, i) => {
    const fr = makePose(e, i * dt);
    out.push(...det.update(fr, extractFeatures(fr)));
  });
  return out;
}
const repeat = (e: PoseEdit, n: number) => Array.from({ length: n }, () => e);

const HANDS_UP: PoseEdit = {
  [P.leftElbow]: [0.24, -0.78],
  [P.rightElbow]: [-0.24, -0.78],
  [P.leftWrist]: [0.25, -1.02],
  [P.rightWrist]: [-0.25, -1.02],
};
const CROSSED: PoseEdit = {
  [P.leftElbow]: [0.22, -0.2, -0.2],
  [P.rightElbow]: [-0.22, -0.2, -0.2],
  [P.leftWrist]: [-0.12, -0.35, -0.3],
  [P.rightWrist]: [0.12, -0.35, -0.3],
};
const pointAt = (x: number, y: number): PoseEdit => ({
  [P.rightElbow]: [-0.3, -0.35, -0.2],
  [P.rightWrist]: [x, y, -0.4],
  [P.rightIndex]: [x, y - 0.06, -0.42],
});

describe('pose gestures', () => {
  it('hands up held ~0.7 s fires once', () => {
    const g = feed(new PoseGestureDetector(), repeat(HANDS_UP, 60));
    expect(g).toEqual(['handsUp']);
  });

  it('brief hands up does not fire', () => {
    expect(feed(new PoseGestureDetector(), [...repeat(HANDS_UP, 10), ...repeat({}, 20)])).toEqual(
      [],
    );
  });

  it('crossed arms fire crossArms', () => {
    expect(feed(new PoseGestureDetector(), repeat(CROSSED, 40))).toEqual(['crossArms']);
  });

  it('standing still fires nothing', () => {
    expect(feed(new PoseGestureDetector(), repeat({}, 90))).toEqual([]);
  });

  it('fast sweep of the right hand toward image +x is a visual swipeLeft', () => {
    const sweep = Array.from({ length: 10 }, (_, i) => ({
      [P.rightElbow]: [-0.3 + i * 0.06, -0.3, -0.2] as [number, number, number],
      [P.rightWrist]: [-0.45 + i * 0.1, -0.3, -0.3] as [number, number, number],
    }));
    expect(feed(new PoseGestureDetector(), sweep)).toEqual(['swipeLeft']);
  });
});

describe('cursor', () => {
  it('is null when hands are down', () => {
    expect(computeCursor(makePose(), null)).toBeNull();
  });

  it('pointing to the user-right/up maps to the screen right/top (mirrored)', () => {
    const c = computeCursor(makePose(pointAt(-0.5, -0.95)), null)!;
    expect(c.hand).toBe('r');
    expect(c.x).toBeGreaterThan(0.8);
    expect(c.y).toBeLessThan(0.2);
  });

  it('pointing in front of the chest is near the screen center', () => {
    const c = computeCursor(makePose(pointAt(0, -0.4)), null)!;
    expect(c.x).toBeGreaterThan(0.35);
    expect(c.x).toBeLessThan(0.65);
  });
});

describe('hand cursor smoothing', () => {
  it('a shaking hand gives a steady cursor', () => {
    const hc = new HandCursor();
    const xs: number[] = [];
    for (let i = 0; i < 60; i++) {
      const jitter = (i % 2 ? 1 : -1) * 0.02; // ±2 cm landmark noise every frame
      const c = hc.update(makePose(pointAt(-0.2 + jitter, -0.6 + jitter), i * 33), i * 33);
      if (i >= 30) xs.push(c!.x);
    }
    const raw = [0, 1].map(
      (k) => computeCursor(makePose(pointAt(-0.2 + (k ? 0.02 : -0.02), -0.6)), null)!.x,
    );
    const rawSpread = Math.abs(raw[0]! - raw[1]!);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(rawSpread * 0.35);
  });

  it('keeps the cursor through a short tracking dropout, hides it after a longer one', () => {
    const hc = new HandCursor();
    for (let i = 0; i < 10; i++) hc.update(makePose(pointAt(-0.2, -0.6), i * 33), i * 33);
    expect(hc.update(null, 400)).not.toBeNull();
    expect(hc.update(null, 700)).toBeNull();
  });

  it('still reaches the screen corner on a fast sweep', () => {
    const hc = new HandCursor();
    let c = null;
    for (let i = 0; i < 20; i++) c = hc.update(makePose(pointAt(-0.5, -0.95), i * 33), i * 33);
    expect(c!.x).toBeGreaterThan(0.8);
    expect(c!.y).toBeLessThan(0.2);
  });
});

describe('dwell', () => {
  const targets = [{ id: 'start', rect: { left: 0.4, top: 0.4, right: 0.6, bottom: 0.6 } }];

  it('selects after holding and does not repeat until leaving', () => {
    const d = new DwellTracker(1000);
    expect(d.update({ x: 0.5, y: 0.5 }, targets, 0).progress).toBe(0);
    expect(d.update({ x: 0.5, y: 0.5 }, targets, 500).progress).toBeCloseTo(0.5);
    expect(d.update({ x: 0.5, y: 0.5 }, targets, 1000).selected).toBe('start');
    expect(d.update({ x: 0.5, y: 0.5 }, targets, 2500).selected).toBeNull();
    d.update({ x: 0.1, y: 0.1 }, targets, 2600);
    d.update({ x: 0.5, y: 0.5 }, targets, 2700);
    expect(d.update({ x: 0.5, y: 0.5 }, targets, 3700).selected).toBe('start');
  });

  it('a shaky hand at the edge of the hovered button keeps filling the ring', () => {
    const d = new DwellTracker(1000);
    d.update({ x: 0.59, y: 0.5 }, targets, 0);
    d.update({ x: 0.62, y: 0.5 }, targets, 300); // just outside, within the sticky margin
    expect(d.update({ x: 0.59, y: 0.5 }, targets, 600).progress).toBeCloseTo(0.6);
  });

  it('resets progress when the cursor leaves', () => {
    const d = new DwellTracker(1000);
    d.update({ x: 0.5, y: 0.5 }, targets, 0);
    d.update({ x: 0.9, y: 0.9 }, targets, 600);
    expect(d.update({ x: 0.5, y: 0.5 }, targets, 700).progress).toBe(0);
  });
});

describe('dwell freeze', () => {
  const a = { id: 'a', rect: { left: 0, top: 0, right: 0.5, bottom: 0.5 } };
  it('does not progress while frozen, then needs a full dwell', () => {
    const d = new DwellTracker(1000);
    d.update({ x: 0.2, y: 0.2 }, [a], 0, true);
    expect(d.update({ x: 0.2, y: 0.2 }, [a], 900, true).progress).toBe(0);
    expect(d.update({ x: 0.2, y: 0.2 }, [a], 1000).progress).toBeCloseTo(0.1);
    expect(d.update({ x: 0.2, y: 0.2 }, [a], 1900).selected).toBe('a');
  });

  it('a selected button stays locked while hovered, even through a freeze', () => {
    const d = new DwellTracker(1000);
    d.update({ x: 0.2, y: 0.2 }, [a], 0);
    expect(d.update({ x: 0.2, y: 0.2 }, [a], 1000).selected).toBe('a');
    d.update({ x: 0.2, y: 0.2 }, [a], 1500, true);
    expect(d.update({ x: 0.2, y: 0.2 }, [a], 5000).selected).toBeNull();
  });
});

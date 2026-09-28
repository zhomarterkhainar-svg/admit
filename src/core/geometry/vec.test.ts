import { describe, expect, it } from 'vitest';
import { angleBetween, jointAngle, leanFromVertical2d } from './vec';

const v = (x: number, y: number, z = 0) => ({ x, y, z });

describe('geometry', () => {
  it('computes right angle', () => {
    expect(jointAngle(v(1, 0), v(0, 0), v(0, 1))).toBeCloseTo(90);
  });
  it('computes straight joint', () => {
    expect(jointAngle(v(0, 0), v(0, 1), v(0, 2))).toBeCloseTo(180);
  });
  it('handles 3D', () => {
    expect(jointAngle(v(1, 0, 0), v(0, 0, 0), v(0, 0, 1))).toBeCloseTo(90);
  });
  it('returns NaN for degenerate vectors', () => {
    expect(angleBetween(v(0, 0), v(1, 0))).toBeNaN();
  });
  it('measures lean from vertical in image coords', () => {
    expect(leanFromVertical2d(v(0.5, 0.8), v(0.5, 0.2))).toBeCloseTo(0);
    expect(leanFromVertical2d(v(0.5, 0.8), v(0.8, 0.5))).toBeCloseTo(45);
    expect(leanFromVertical2d(v(0.5, 0.8), v(0.2, 0.5))).toBeCloseTo(-45);
  });
});

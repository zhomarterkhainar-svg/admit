import type { Landmark } from '../types';
import { OneEuroFilter, type OneEuroOptions } from './oneEuro';

/** Applies an independent One Euro filter to x/y/z of every landmark. */
export class LandmarkSmoother {
  private filters: OneEuroFilter[][] = [];

  constructor(private readonly opts: OneEuroOptions = { minCutoff: 1.2, beta: 0.05 }) {}

  smooth(landmarks: Landmark[], tMs: number): Landmark[] {
    if (this.filters.length !== landmarks.length) {
      this.filters = landmarks.map(() => [0, 1, 2].map(() => new OneEuroFilter(this.opts)));
    }
    return landmarks.map((lm, i) => {
      const [fx, fy, fz] = this.filters[i]!;
      return {
        x: fx!.filter(lm.x, tMs),
        y: fy!.filter(lm.y, tMs),
        z: fz!.filter(lm.z, tMs),
        visibility: lm.visibility,
      };
    });
  }

  reset(): void {
    this.filters = [];
  }
}

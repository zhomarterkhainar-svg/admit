/**
 * Dynamic Time Warping distance between two 1-D sequences, normalized by the warping-path length.
 * `window` is the Sakoe–Chiba band (in samples) that stops pathological warps.
 */
export function dtw(a: number[], b: number[], window = Math.max(a.length, b.length)): number {
  const n = a.length;
  const m = b.length;
  if (!n || !m) return Infinity;
  const w = Math.max(window, Math.abs(n - m));
  const INF = Number.POSITIVE_INFINITY;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(INF));
  const steps: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  cost[0]![0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(1, i - w); j <= Math.min(m, i + w); j++) {
      const d = Math.abs(a[i - 1]! - b[j - 1]!);
      const options: [number, number][] = [
        [cost[i - 1]![j]!, steps[i - 1]![j]!],
        [cost[i]![j - 1]!, steps[i]![j - 1]!],
        [cost[i - 1]![j - 1]!, steps[i - 1]![j - 1]!],
      ];
      const [best, s] = options.reduce((x, y) => (y[0] < x[0] ? y : x));
      cost[i]![j] = best + d;
      steps[i]![j] = s + 1;
    }
  }
  return cost[n]![m]! / Math.max(1, steps[n]![m]!);
}

/** Linear resampling of an irregularly sampled signal onto `n` evenly spaced points. */
export function resample(samples: { t: number; v: number }[], n: number): number[] {
  if (samples.length === 0) return [];
  if (samples.length === 1) return new Array<number>(n).fill(samples[0]!.v);
  const t0 = samples[0]!.t;
  const t1 = samples.at(-1)!.t;
  const out: number[] = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + ((t1 - t0) * i) / (n - 1);
    while (k < samples.length - 2 && samples[k + 1]!.t < t) k++;
    const a = samples[k]!;
    const b = samples[k + 1]!;
    const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    out.push(a.v + (b.v - a.v) * Math.min(1, Math.max(0, f)));
  }
  return out;
}

const N = 32;
/** Ideal rep: smooth down-and-up with a short controlled pause at the bottom. */
const REFERENCE = Array.from({ length: N }, (_, i) =>
  Math.min(1, 1.12 * Math.sin((Math.PI * i) / (N - 1))),
);

/**
 * Movement control / smoothness score 0..100 for one rep: how close the depth trajectory is to a
 * smooth down-pause-up curve (after normalizing amplitude and duration). Bouncing, jerks and
 * stop-and-go reps score lower. Depth itself is judged by the exercise rules, not here.
 */
export function smoothnessScore(samples: { t: number; v: number }[]): number | undefined {
  if (samples.length < 6) return undefined;
  const raw = resample(samples, N);
  const lo = Math.min(...raw);
  const hi = Math.max(...raw);
  if (hi - lo < 0.15) return undefined; // barely moved: nothing to judge
  const norm = raw.map((v) => (v - lo) / (hi - lo));
  const d = dtw(norm, REFERENCE, 6);
  // jerk: mean absolute second difference, 0 for a straight line / sine at this resolution ≈ 0.01
  let jerk = 0;
  for (let i = 1; i < N - 1; i++) jerk += Math.abs(norm[i + 1]! - 2 * norm[i]! + norm[i - 1]!);
  jerk /= N - 2;
  const score = 100 * Math.exp(-3 * d) * Math.exp(-6 * Math.max(0, jerk - 0.02));
  return Math.round(Math.max(0, Math.min(100, score)));
}

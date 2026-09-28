export interface Sample {
  v: number[];
  label: string;
}

export interface Prediction {
  label: string;
  /** share of the distance-weighted vote won by `label`, 0..1 */
  confidence: number;
}

/** Distance-weighted k-nearest-neighbours classifier (tiny, dependency-free, deterministic). */
export class KnnClassifier {
  private readonly samples: Sample[] = [];

  constructor(private readonly k = 7) {}

  add(v: number[], label: string): void {
    this.samples.push({ v, label });
  }

  addAll(samples: Sample[]): void {
    for (const s of samples) this.add(s.v, s.label);
  }

  get size(): number {
    return this.samples.length;
  }

  predict(v: number[]): Prediction {
    const nearest = this.samples
      .map((s) => ({ s, d: dist2(s.v, v) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this.k);
    const votes = new Map<string, number>();
    let total = 0;
    for (const { s, d } of nearest) {
      const w = 1 / (Math.sqrt(d) + 1e-3);
      votes.set(s.label, (votes.get(s.label) ?? 0) + w);
      total += w;
    }
    let best = '';
    let bestW = -1;
    for (const [label, w] of votes) if (w > bestW) [best, bestW] = [label, w];
    return { label: best, confidence: total ? bestW / total : 0 };
  }
}

function dist2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i]! - b[i]!) ** 2;
  return s;
}

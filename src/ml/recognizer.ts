import type { FrameFeatures } from '@/core/types';
import { KnnClassifier, type Sample } from './knn';
import { STAND, syntheticSamples } from './dataset';
import { toVector } from './vector';
import extra from './extra-samples.json';

let shared: KnnClassifier | null = null;

/** The built-in model: synthetic reference poses + samples trained from the team's recordings. */
export function defaultClassifier(): KnnClassifier {
  if (!shared) {
    shared = new KnnClassifier(7);
    shared.addAll(syntheticSamples());
    shared.addAll(extra as Sample[]);
  }
  return shared;
}

export interface Recognition {
  /** dominant non-"stand" exercise over the window, if any */
  label: string | null;
  /** share of recent moving frames voting for `label` */
  share: number;
}

/**
 * Temporal smoothing over per-frame kNN predictions: which exercise has the user been doing
 * during the last `windowMs`? Frames classified as "stand" are ignored.
 */
export class ExerciseRecognizer {
  private history: { t: number; label: string }[] = [];

  constructor(
    private readonly clf: KnnClassifier = defaultClassifier(),
    private readonly windowMs = 1800,
    private readonly minConfidence = 0.6,
  ) {}

  update(f: FrameFeatures | null): Recognition {
    if (f) {
      const p = this.clf.predict(toVector(f));
      if (p.label !== STAND && p.confidence >= this.minConfidence)
        this.history.push({ t: f.t, label: p.label });
      this.history = this.history.filter((h) => f.t - h.t <= this.windowMs);
    }
    if (this.history.length < 8) return { label: null, share: 0 };
    const counts = new Map<string, number>();
    for (const h of this.history) counts.set(h.label, (counts.get(h.label) ?? 0) + 1);
    const [label, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
    return { label, share: n / this.history.length };
  }

  reset(): void {
    this.history = [];
  }
}

import type { PoseFrame } from '@/core/types';

/** Compact, round-tripping JSON for recorded sessions (≈4 decimals is plenty for landmarks). */
export interface Recording {
  version: 1;
  exercise: string;
  label: string;
  recordedAt: string;
  frames: PoseFrame[];
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function compactFrame(f: PoseFrame): PoseFrame {
  const lm = (l: PoseFrame['image'][number]) => ({
    x: r4(l.x),
    y: r4(l.y),
    z: r4(l.z),
    visibility: r4(l.visibility),
  });
  return {
    t: Math.round(f.t),
    width: f.width,
    height: f.height,
    image: f.image.map(lm),
    world: f.world.map(lm),
  };
}

export function downloadRecording(rec: Recording): void {
  const blob = new Blob([JSON.stringify(rec)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${rec.exercise}__${rec.label}__${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

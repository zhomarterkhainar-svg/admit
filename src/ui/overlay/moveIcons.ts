import { makePose } from '@/core/reference/template';
import { MOVES, MOVE_IDS, type MoveId } from '@/game/dance/moves';
import { drawSkeleton } from './drawSkeleton';
import { fitFrame } from './GhostPreview';

export interface MoveIcon {
  /** for drawImage on the dance lane (60 fps: no redrawing of skeletons per frame) */
  canvas: HTMLCanvasElement;
  /** for <img> in the DOM (legend, the big "next move" card) */
  url: string;
}

const SIZE = 160;
let cache: Record<MoveId, MoveIcon> | null = null;

/** Every dance move's reference pose, drawn once into a small offscreen canvas. */
export function moveIcons(): Record<MoveId, MoveIcon> {
  if (cache) return cache;
  const out = {} as Record<MoveId, MoveIcon>;
  for (const id of MOVE_IDS) {
    const canvas = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE });
    const ctx = canvas.getContext('2d')!;
    const frame = fitFrame(makePose(MOVES[id].pose).world, SIZE, SIZE);
    drawSkeleton(ctx, frame, { color: '#1cb0f6', lineWidth: 44, head: true, now: 0 });
    out[id] = { canvas, url: canvas.toDataURL() };
  }
  return (cache = out);
}

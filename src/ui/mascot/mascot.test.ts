import { describe, expect, it } from 'vitest';
import { mascotSvg, mascotUrl, type Mood } from './mascot';

const MOODS: Mood[] = ['happy', 'wave', 'cheer', 'oops', 'think', 'sad'];

describe('Barys mascot', () => {
  it.each(MOODS)('%s renders a well-formed SVG', (mood) => {
    const svg = mascotSvg(mood);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect(svg).not.toMatch(/NaN|undefined/);
    // every opened group is closed
    expect(svg.match(/<g\b/g)?.length ?? 0).toBe(svg.match(/<\/g>/g)?.length ?? 0);
  });

  it('moods look different', () => {
    expect(new Set(MOODS.map(mascotSvg)).size).toBe(MOODS.length);
  });

  it('data url is cached and encoded', () => {
    expect(mascotUrl('cheer')).toBe(mascotUrl('cheer'));
    expect(mascotUrl('cheer').startsWith('data:image/svg+xml')).toBe(true);
  });
});

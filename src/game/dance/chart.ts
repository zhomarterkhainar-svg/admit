import type { MoveId } from './moves';

export const BPM = 120;
export const BEAT_MS = 60_000 / BPM;

export type SectionId = 'intro' | 'A' | 'B' | 'A2' | 'B2' | 'outro';
export interface Section {
  id: SectionId;
  startBeat: number;
  beats: number;
}

/** Intro 8 beats → A 32 → B 32 → A′ 32 → B′ 32 → outro 8 (144 beats ≈ 72 s at 120 BPM). */
export const SECTIONS: readonly Section[] = (() => {
  const lens: [SectionId, number][] = [
    ['intro', 8],
    ['A', 32],
    ['B', 32],
    ['A2', 32],
    ['B2', 32],
    ['outro', 8],
  ];
  let beat = 0;
  return lens.map(([id, beats]) => {
    const s = { id, startBeat: beat, beats };
    beat += beats;
    return s;
  });
})();
export const SONG_BEATS = SECTIONS.reduce((n, s) => n + s.beats, 0);
export const SONG_MS = SONG_BEATS * BEAT_MS;

export const sectionAt = (beat: number): Section =>
  SECTIONS.find((s) => beat >= s.startBeat && beat < s.startBeat + s.beats) ?? SECTIONS.at(-1)!;

/** Choreography of each section, one move per 2 beats. */
const PATTERN: Record<'A' | 'B', MoveId[]> = {
  A: [
    'reins', 'leanL', 'reins', 'leanR', 'reins', 'leanL', 'reins', 'leanR',
    'wings', 'up', 'wings', 'up', 'clap', 'clap', 'reins', 'reins',
  ],
  B: [
    'up', 'wings', 'up', 'wings', 'kneeL', 'kneeR', 'kneeL', 'kneeR',
    'clap', 'up', 'clap', 'up', 'squat', 'up', 'squat', 'up',
  ],
};

/** "Easy": a move every 4 beats; "medium": every 2. */
export type Level = 'easy' | 'mid';

export interface Note {
  /** index in the chart */
  i: number;
  beat: number;
  /** song time of the beat, ms */
  t: number;
  move: MoveId;
}

export function chart(level: Level): Note[] {
  const step = level === 'mid' ? 2 : 4;
  const notes: Note[] = [];
  for (const s of SECTIONS) {
    if (s.id === 'intro' || s.id === 'outro') continue;
    const pattern = PATTERN[s.id === 'A' || s.id === 'A2' ? 'A' : 'B'];
    for (let b = 0; b < s.beats; b += step) {
      const beat = s.startBeat + b;
      notes.push({ i: notes.length, beat, t: beat * BEAT_MS, move: pattern[b / 2]! });
    }
  }
  return notes;
}

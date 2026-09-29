// "Qara Zhorga" on a synthesized dombra: two plucked strings (Karplus–Strong), the pacing
// "zhorga" strum, a dabyl (frame drum) and a shaker. Scheduled ahead on the Web Audio clock,
// and the song position is read from the audio OUTPUT clock so the game stays in sync with
// what the player hears.
import { audioContext } from './sfx';
import { BEAT_MS, SECTIONS, SONG_BEATS, sectionAt } from '@/game/dance/chart';

const BEAT = BEAT_MS / 1000;
/** schedule this far ahead (s), checking every 25 ms */
const LOOKAHEAD = 0.15;
const TICK_MS = 25;
/** the song starts this long after start() (s) */
const LEAD_IN = 0.12;

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const D3 = 50;
const G3 = 55;

/** Melodies (MIDI, G mixolydian), one note per 2 beats — 16 notes = one 32-beat section. */
const MELODY = {
  A: [59, 57, 55, 55, 57, 59, 62, 62, 64, 62, 59, 57, 59, 57, 55, 55],
  B: [67, 67, 69, 67, 64, 62, 64, 67, 71, 69, 67, 64, 62, 64, 62, 59],
};
/** G mixolydian pitch classes, for the harmony a third above */
const SCALE = [7, 9, 11, 0, 2, 4, 5];
export function thirdAbove(m: number): number {
  const pc = ((m % 12) + 12) % 12;
  const i = SCALE.indexOf(pc);
  if (i < 0) return m + 4;
  const up = SCALE[(i + 2) % 7]!;
  return m + ((up - pc + 12) % 12);
}

/** The melody note sounding at `beat` (null in the intro / outro). */
export function melodyAt(beat: number): number | null {
  const s = sectionAt(beat);
  if (s.id === 'intro' || s.id === 'outro') return null;
  const tune = MELODY[s.id === 'A' || s.id === 'A2' ? 'A' : 'B'];
  const note = tune[Math.floor((beat - s.startBeat) / 2)]!;
  // the second time round the tune goes up an octave on its last bar, a little flourish
  return s.id === 'A2' || s.id === 'B2' ? (beat - s.startBeat >= 28 ? note + 12 : note) : note;
}

export class DombraSong {
  private readonly ctx: AudioContext;
  private readonly out: GainNode;
  private readonly cache = new Map<number, AudioBuffer>();
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** context time of beat 0 */
  private t0 = 0;
  /** next sub-beat to schedule: beats are split into thirds (0, ⅓, ⅔) */
  private nextStep = 0;
  private harmony = false;
  private pausedAt: number | null = null;
  private playing = false;

  readonly durationMs = SONG_BEATS * BEAT_MS;

  constructor() {
    this.ctx = audioContext();
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(this.ctx.destination);
  }

  start(): void {
    void this.ctx.resume();
    this.t0 = this.ctx.currentTime + LEAD_IN;
    this.nextStep = 0;
    this.playing = true;
    this.pausedAt = null;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  /** Suspends the whole audio clock: the song position freezes with it. */
  pause(): void {
    if (!this.playing || this.pausedAt !== null) return;
    this.pausedAt = this.songMsAt(performance.now());
    void this.ctx.suspend();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    this.pausedAt = null;
    void this.ctx.resume();
  }

  stop(): void {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx.resume();
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    setTimeout(() => this.out.disconnect(), 400);
  }

  /** A second dombra a third higher (while the combo is hot). */
  setHarmony(on: boolean): void {
    this.harmony = on;
  }

  /**
   * Song position (ms) at a performance.now() moment, as heard: the output timestamp maps the
   * audio clock to the page clock and includes the output latency. Negative before the start.
   */
  songMsAt(perfMs: number): number {
    if (this.pausedAt !== null) return this.pausedAt;
    const ts = this.ctx.getOutputTimestamp?.();
    let sec: number;
    if (ts && ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0)
      sec = ts.contextTime + (perfMs - ts.performanceTime) / 1000 - this.t0;
    else sec = this.ctx.currentTime - this.t0 - (this.ctx.outputLatency || 0);
    return sec * 1000;
  }

  private schedule(): void {
    if (!this.playing) return;
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    while (this.nextStep < SONG_BEATS * 3) {
      const at = this.t0 + (this.nextStep * BEAT) / 3;
      if (at > horizon) break;
      this.step(this.nextStep, at);
      this.nextStep++;
    }
    if (this.nextStep >= SONG_BEATS * 3 && this.ctx.currentTime > this.t0 + SONG_BEATS * BEAT + 2)
      this.stop();
  }

  /** One third of a beat: "DAM-da" = a strong strum on 0, a light one on ⅔. */
  private step(n: number, at: number): void {
    const beat = Math.floor(n / 3);
    const third = n % 3;
    const section = sectionAt(beat);
    const intro = section.id === 'intro';
    const outro = section.id === 'outro';
    const tune = melodyAt(beat) ?? G3 + 12;
    if (third === 0) {
      this.kick(at, beat % 2 === 0 ? 1 : 0.7);
      if (!outro || beat < SECTIONS.at(-1)!.startBeat + 1)
        this.strum(at, intro ? null : tune, 'down');
    } else if (third === 2) {
      this.strum(at, intro ? null : tune, 'up');
      this.shaker(at, 0.5);
    } else if (!intro) {
      this.shaker(at, 0.25);
    }
  }

  /** Both strings: the D drone and the G / melody string, the pick sweeping across them. */
  private strum(at: number, melody: number | null, dir: 'down' | 'up'): void {
    const accent = dir === 'down' ? 1 : 0.55;
    const spread = 0.012 + Math.random() * 0.006; // 12–18 ms between strings
    const strings = [D3, melody ?? G3];
    const order = dir === 'down' ? strings : [...strings].reverse();
    order.forEach((m, i) => this.pluck(midiHz(m), at + i * spread, 0.22 * accent));
    if (this.harmony && melody !== null)
      this.pluck(midiHz(thirdAbove(melody)), at + 2 * spread, 0.12 * accent);
  }

  private pluck(freq: number, at: number, gain: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.string(freq);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.out);
    src.start(at);
  }

  /** Karplus–Strong string, rendered once per pitch and cached. */
  private string(freq: number): AudioBuffer {
    const key = Math.round(freq * 10);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * 1.1);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    const period = Math.max(2, Math.round(sr / freq));
    const ring = Array.from({ length: period }, () => Math.random() * 2 - 1);
    for (let i = 0; i < len; i++) {
      const j = i % period;
      ring[j] = 0.994 * 0.5 * (ring[j]! + ring[(j + 1) % period]!);
      data[i] = ring[j]!;
    }
    this.cache.set(key, buf);
    return buf;
  }

  /** Dabyl: a sine sweeping 120 → 50 Hz with a quick decay. */
  private kick(at: number, gain: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(120, at);
    o.frequency.exponentialRampToValueAtTime(50, at + 0.12);
    g.gain.setValueAtTime(0.5 * gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
    o.connect(g).connect(this.out);
    o.start(at);
    o.stop(at + 0.25);
  }

  /** Shaker: a short band-passed noise burst. */
  private shaker(at: number, gain: number): void {
    if (!this.noise) {
      const sr = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, Math.floor(sr * 0.06), sr);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = 0.09 * gain;
    src.connect(bp).connect(g).connect(this.out);
    src.start(at);
  }
}

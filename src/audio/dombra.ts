// "Qara Zhorga" on a synthesized dombra: two plucked strings (Karplus–Strong), the pacing
// "zhorga" strum, a dabyl (frame drum) and a shaker. Scheduled ahead on the Web Audio clock,
// and the song position is read from the audio OUTPUT clock so the game stays in sync with
// what the player hears.
import { audioContext, audioOut } from './sfx';
import { ksBuffer } from './strings';
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

/** Mix levels. Several notes ring at once: kept low, and the master limiter catches peaks. */
const LEVEL = {
  song: 0.8,
  down: 0.2,
  up: 0.11,
  harmony: 0.09,
  kick: 0.32,
  shaker: 0.035,
};

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

/** A dombra has two strings plus our harmony voice: each is damped when plucked again. */
type StringId = 'drone' | 'melody' | 'harmony';

export class DombraSong {
  private readonly out: GainNode;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** context time of beat 0 */
  private t0 = 0;
  /** next sub-beat to schedule: beats are split into thirds (0, ⅓, ⅔) */
  private nextStep = 0;
  private harmony = false;
  private pausedAt: number | null = null;
  private playing = false;
  /** the note still ringing on each string (a new pluck mutes it, like a real string) */
  private readonly ringing = new Map<StringId, GainNode>();

  readonly durationMs = SONG_BEATS * BEAT_MS;

  /** @param ctx the live context by default; an OfflineAudioContext renders the song to a buffer */
  constructor(
    private readonly ctx: BaseAudioContext = audioContext(),
    dest: AudioNode = audioOut(),
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = LEVEL.song;
    this.out.connect(dest);
  }

  /**
   * Render the first `seconds` of the song offline (for tests / checking the mix): the same
   * scheduling as live, through the same kind of limiter.
   */
  static async render(seconds: number, harmony = false, sampleRate = 44100): Promise<AudioBuffer> {
    const off = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
    const limiter = off.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 4;
    limiter.ratio.value = 16;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(off.destination);
    const song = new DombraSong(off, limiter);
    song.harmony = harmony;
    song.t0 = 0;
    song.playing = true;
    song.scheduleUntil(seconds);
    return off.startRendering();
  }

  start(): void {
    const ctx = this.ctx as AudioContext;
    void ctx.resume?.();
    this.t0 = ctx.currentTime + LEAD_IN;
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
    void (this.ctx as AudioContext).suspend?.();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    this.pausedAt = null;
    void (this.ctx as AudioContext).resume?.();
  }

  stop(): void {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void (this.ctx as AudioContext).resume?.();
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
    const ctx = this.ctx as AudioContext;
    const ts = ctx.getOutputTimestamp?.();
    let sec: number;
    if (
      ts &&
      ts.contextTime !== undefined &&
      ts.performanceTime !== undefined &&
      ts.performanceTime > 0
    )
      sec = ts.contextTime + (perfMs - ts.performanceTime) / 1000 - this.t0;
    else sec = ctx.currentTime - this.t0 - (ctx.outputLatency || 0);
    return sec * 1000;
  }

  private schedule(): void {
    if (!this.playing) return;
    this.scheduleUntil(this.ctx.currentTime + LOOKAHEAD - this.t0);
    if (this.nextStep >= SONG_BEATS * 3 && this.ctx.currentTime > this.t0 + SONG_BEATS * BEAT + 2)
      this.stop();
  }

  /** Queue every sub-beat up to `songSec` seconds into the song. */
  private scheduleUntil(songSec: number): void {
    while (this.nextStep < SONG_BEATS * 3) {
      const at = this.t0 + (this.nextStep * BEAT) / 3;
      if (at - this.t0 > songSec) break;
      this.step(this.nextStep, Math.max(at, this.ctx.currentTime));
      this.nextStep++;
    }
  }

  /** One third of a beat: "DAM-da" = a strong strum on 0, a light one on ⅔. */
  private step(n: number, at: number): void {
    const beat = Math.floor(n / 3);
    const third = n % 3;
    const section = sectionAt(beat);
    const intro = section.id === 'intro';
    const lastBeat = SECTIONS.at(-1)!.startBeat;
    // the outro: one last strum and a long ring, then the drum fades
    if (section.id === 'outro' && beat > lastBeat) {
      if (third === 0 && beat < lastBeat + 4) this.kick(at, 0.5);
      return;
    }
    const tune = melodyAt(beat) ?? G3 + 12;
    if (third === 0) {
      this.kick(at, beat % 2 === 0 ? 1 : 0.7);
      this.strum(at, intro ? null : tune, 'down');
    } else if (third === 2) {
      this.strum(at, intro ? null : tune, 'up');
      this.shaker(at, 1);
    } else if (!intro) {
      this.shaker(at, 0.5);
    }
  }

  /** Both strings: the D drone and the G / melody string, the pick sweeping across them. */
  private strum(at: number, melody: number | null, dir: 'down' | 'up'): void {
    const level = dir === 'down' ? LEVEL.down : LEVEL.up;
    const spread = 0.012 + Math.random() * 0.006; // 12–18 ms between strings
    const strings: [StringId, number][] = [
      ['drone', D3],
      ['melody', melody ?? G3],
    ];
    if (dir === 'up') strings.reverse();
    strings.forEach(([id, m], i) => this.pluck(id, midiHz(m), at + i * spread, level));
    if (this.harmony && melody !== null)
      this.pluck('harmony', midiHz(thirdAbove(melody)), at + 2 * spread, LEVEL.harmony);
  }

  private pluck(string: StringId, freq: number, at: number, gain: number): void {
    // re-plucking a string stops what it was still ringing (no pile-up of notes, no mud)
    this.ringing.get(string)?.gain.setTargetAtTime(0, at, 0.012);
    const src = this.ctx.createBufferSource();
    src.buffer = ksBuffer(this.ctx, freq, 1.2, 0.995);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.out);
    src.start(at);
    this.ringing.set(string, g);
  }

  /** Dabyl: a sine sweeping 120 → 50 Hz with a quick decay. */
  private kick(at: number, gain: number): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(120, at);
    o.frequency.exponentialRampToValueAtTime(50, at + 0.12);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(LEVEL.kick * gain, at + 0.004);
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
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = LEVEL.shaker * gain;
    src.connect(bp).connect(g).connect(this.out);
    src.start(at);
  }
}

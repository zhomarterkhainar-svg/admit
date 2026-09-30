// Tiny synthesized SFX — no audio assets needed.
import { ksBuffer } from './strings';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

/**
 * The app's one AudioContext. Everything plays through one master chain:
 * master gain (the mute switch) → limiter (a brick-wall compressor, so overlapping sounds
 * never clip into distortion) → speakers.
 */
function ac(): AudioContext {
  if (ctx) return ctx;
  ctx = new AudioContext();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 4;
  limiter.ratio.value = 16;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(limiter).connect(ctx.destination);
  return ctx;
}

/** The shared AudioContext (the dance music plays in it too). */
export const audioContext = ac;

/** Where every sound connects: the master gain in front of the limiter. */
export function audioOut(): GainNode {
  ac();
  return master!;
}

/** The sound switch in the settings silences effects and music, not only the voice. */
export function setSoundMuted(m: boolean): void {
  muted = m;
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
}

/** Call from a user gesture once (browsers block audio before interaction). */
export function unlockAudio(): void {
  void ac().resume();
  // iOS only allows speech after a user gesture: warm the synthesizer up inside the click
  try {
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(''));
  } catch {
    /* no speech support */
  }
}

/** Plucked-string "dombra" tone. */
function pluck(freq: number, at = 0, gain = 0.3): void {
  const a = ac();
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = gain;
  src.buffer = ksBuffer(a, freq, 0.6);
  src.connect(g).connect(audioOut());
  src.start(a.currentTime + at);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.15): void {
  const a = ac();
  const o = a.createOscillator();
  const g = a.createGain();
  const t = a.currentTime;
  o.type = type;
  o.frequency.value = freq;
  // a 5 ms attack: starting at full level clicks
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(audioOut());
  o.start(t);
  o.stop(t + dur + 0.02);
}

// scheduled on the audio clock (not setTimeout): the notes of a chime never drift apart
export const sfx = {
  rep: () => {
    pluck(392);
    pluck(587, 0.09);
  },
  perfect: () => {
    pluck(392);
    pluck(494, 0.08);
    pluck(587, 0.16);
  },
  notCounted: () => tone(180, 0.25, 'triangle'),
  hint: () => tone(660, 0.12, 'sine', 0.08),
  select: () => tone(880, 0.08, 'sine', 0.1),
};

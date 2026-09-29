// Tiny synthesized SFX — no audio assets needed.
let ctx: AudioContext | null = null;
const ac = () => (ctx ??= new AudioContext());
/** The app's one AudioContext (the dance music shares it with the sound effects). */
export const audioContext = ac;

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

/** Plucked-string "dombra" tone via Karplus–Strong. */
function pluck(freq: number, dur = 0.6, gain = 0.35): void {
  const a = ac();
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  const period = Math.floor(a.sampleRate / freq);
  const ring = Array.from({ length: period }, () => Math.random() * 2 - 1);
  for (let i = 0; i < len; i++) {
    const j = i % period;
    const next = ring[(j + 1) % period]!;
    ring[j] = 0.996 * 0.5 * (ring[j]! + next);
    data[i] = ring[j]!;
  }
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(a.destination);
  src.start();
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.15): void {
  const a = ac();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

export const sfx = {
  rep: () => {
    pluck(392);
    setTimeout(() => pluck(587), 90);
  },
  perfect: () => {
    pluck(392);
    setTimeout(() => pluck(494), 80);
    setTimeout(() => pluck(587), 160);
  },
  notCounted: () => tone(180, 0.25, 'triangle'),
  hint: () => tone(660, 0.12, 'sine', 0.08),
  select: () => tone(880, 0.08, 'sine', 0.1),
};

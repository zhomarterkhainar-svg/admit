// Plucked-string tones (Karplus–Strong) shared by the sound effects and the dance music.

/** end fade: a buffer that stops while the string still rings would click */
const FADE_OUT_S = 0.08;
/** a 3 ms fade-in keeps the attack from clicking too */
const FADE_IN_S = 0.003;

const caches = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/**
 * One plucked note, rendered once per (pitch, length, damping) and cached per context.
 * - the excitation is noise smoothed twice (a plectrum rather than a burst of hiss) with its
 *   DC removed, so the attack is round instead of harsh;
 * - normalised to a peak of 1, so every pitch plays at the same level;
 * - faded in and out, so a note that ends while still ringing never clicks.
 */
export function ksBuffer(
  ctx: BaseAudioContext,
  freq: number,
  seconds: number,
  damping = 0.996,
): AudioBuffer {
  let cache = caches.get(ctx);
  if (!cache) caches.set(ctx, (cache = new Map()));
  const key = `${Math.round(freq * 10)}:${seconds}:${damping}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * seconds));
  const period = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  for (let pass = 0; pass < 2; pass++)
    for (let i = period - 1; i > 0; i--) ring[i] = 0.5 * (ring[i]! + ring[i - 1]!);
  const mean = ring.reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period; i++) ring[i] = ring[i]! - mean;

  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let peak = 1e-6;
  for (let i = 0; i < len; i++) {
    const j = i % period;
    const v = ring[j]!;
    data[i] = v;
    peak = Math.max(peak, Math.abs(v));
    ring[j] = damping * 0.5 * (v + ring[(j + 1) % period]!);
  }
  const fadeIn = Math.floor(sr * FADE_IN_S);
  const fadeOut = Math.min(len, Math.floor(sr * FADE_OUT_S));
  for (let i = 0; i < len; i++) {
    let g = 1 / peak;
    if (i < fadeIn) g *= i / fadeIn;
    if (i >= len - fadeOut) g *= (len - i) / fadeOut;
    data[i] = data[i]! * g;
  }
  cache.set(key, buf);
  return buf;
}

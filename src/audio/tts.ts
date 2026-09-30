import { getLang, tIn, type I18nKey, type Lang } from '@/i18n';
import { setSoundMuted } from './sfx';

const LOCALE: Record<Lang, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US' };
let muted = false;

/** Chrome drops an utterance queued right after cancel(): speak a moment later. */
const AFTER_CANCEL_MS = 60;
/** Chrome can get stuck "speaking" forever (and cuts phrases after ~15 s): give up after this. */
const STUCK_MS = 12_000;

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;

/** The sound switch: the voice, the effects and the music. */
export const setMuted = (m: boolean) => {
  muted = m;
  setSoundMuted(m);
  if (m) synth()?.cancel();
};

// the voice list loads asynchronously (empty at first in Chrome): keep it fresh
let voices: SpeechSynthesisVoice[] = [];
const loadVoices = () => (voices = synth()?.getVoices() ?? []);
if (synth()) {
  loadVoices();
  synth()!.addEventListener?.('voiceschanged', loadVoices);
}

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  if (!voices.length) loadVoices();
  const lang = locale.slice(0, 2);
  return (
    voices.find((v) => v.lang === locale && /google|natural|premium/i.test(v.name)) ??
    voices.find((v) => v.lang === locale) ??
    voices.find((v) => v.lang.startsWith(lang)) ??
    // Kazakh voices are rare: fall back to Russian
    (lang === 'kk' ? voices.find((v) => v.lang.startsWith('ru')) : undefined)
  );
}

/** Text to speak: a plain string, or a builder that receives a translator (preferred). */
export type Phrase = string | ((tr: (key: I18nKey) => string) => string);

let seq = 0;
let startedAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Stop talking now (e.g. when the dance music starts). */
export function stopSpeech(): void {
  seq++;
  if (timer) clearTimeout(timer);
  timer = null;
  synth()?.cancel();
}

/**
 * Speaks a short coaching phrase, interrupting the previous one.
 * Kazakh voices are rare in browsers: with no kk voice, phrases given as builders are spoken
 * in Russian (the screen stays in Kazakh) instead of mispronouncing Kazakh with a Russian voice.
 */
export function speak(phrase: Phrase): void {
  const s = synth();
  if (muted || !s) return;
  let lang = getLang();
  let voice = pickVoice(LOCALE[lang]);
  if (lang === 'kk' && !voice?.lang.startsWith('kk') && typeof phrase === 'function') {
    lang = 'ru';
    voice = pickVoice(LOCALE.ru);
  }
  const text = typeof phrase === 'function' ? phrase((key) => tIn(lang, key)) : phrase;
  if (!text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? LOCALE[lang];
  u.rate = 1.05;

  // only the latest phrase is spoken, even if several arrive within the cancel delay
  const my = ++seq;
  const busy = s.speaking || s.pending;
  if (busy) s.cancel();
  if (timer) clearTimeout(timer);
  const go = () => {
    timer = null;
    if (my !== seq || muted) return;
    s.resume(); // a paused synthesizer (Chrome on Windows) would queue forever
    startedAt = performance.now();
    s.speak(u);
  };
  if (busy) timer = setTimeout(go, AFTER_CANCEL_MS);
  else go();
}

/** Low-priority phrase (e.g. rep count): skipped if the coach is already talking. */
export function speakIfIdle(text: string): void {
  const s = synth();
  if (!s || muted) return;
  const talking =
    (s.speaking || s.pending || timer !== null) && performance.now() - startedAt < STUCK_MS;
  if (talking) return;
  speak(text);
}

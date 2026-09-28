import { getLang, tIn, type I18nKey, type Lang } from '@/i18n';

const LOCALE: Record<Lang, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US' };
let muted = false;

export const setMuted = (m: boolean) => {
  muted = m;
  if (m) speechSynthesis?.cancel();
};

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
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

/**
 * Speaks a short coaching phrase, interrupting the previous one.
 * Kazakh voices are rare in browsers: with no kk voice, phrases given as builders are spoken
 * in Russian (the screen stays in Kazakh) instead of mispronouncing Kazakh with a Russian voice.
 */
export function speak(phrase: Phrase): void {
  if (muted || typeof window === 'undefined' || !window.speechSynthesis) return;
  let lang = getLang();
  let voice = pickVoice(LOCALE[lang]);
  if (lang === 'kk' && !voice?.lang.startsWith('kk') && typeof phrase === 'function') {
    lang = 'ru';
    voice = pickVoice(LOCALE.ru);
  }
  const text = typeof phrase === 'function' ? phrase((key) => tIn(lang, key)) : phrase;
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? LOCALE[lang];
  u.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/** Low-priority phrase (e.g. rep count): skipped if the coach is already talking. */
export function speakIfIdle(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (speechSynthesis.speaking || speechSynthesis.pending) return;
  speak(text);
}

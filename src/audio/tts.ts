import { getLang, type Lang } from '@/i18n';

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

/** Speaks a short coaching phrase, interrupting the previous one. */
export function speak(text: string): void {
  if (muted || typeof window === 'undefined' || !window.speechSynthesis) return;
  const locale = LOCALE[getLang()];
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(locale);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? locale;
  u.rate = 1.05;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

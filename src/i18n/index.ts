import { ru, type I18nKey } from './ru';
import { en } from './en';
import { kk } from './kk';

export type { I18nKey };
export type Lang = 'ru' | 'kk' | 'en';

const dicts: Record<Lang, Partial<Record<I18nKey, string>>> = { ru, kk, en };

let lang: Lang = 'ru';

export const setLang = (l: Lang) => {
  lang = l;
};
export const getLang = () => lang;

export function t(key: I18nKey): string {
  return tIn(lang, key);
}

/**
 * Plural form for counters: `${n} ${plural(n, 'streak.days')}` → «1 день», «3 дня», «5 дней».
 * Uses `<base>.one` / `<base>.few` / `<base>` (many) keys; kk/en simply provide equal or two forms.
 */
export function plural(n: number, base: 'streak.days' | 'ach.count'): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (lang === 'en') return t(n === 1 ? `${base}.one` : base);
  if (n10 === 1 && n100 !== 11) return t(`${base}.one`);
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return t(`${base}.few`);
  return t(base);
}

/** Translate into a specific language (e.g. Russian speech when no Kazakh voice exists). */
export function tIn(l: Lang, key: I18nKey): string {
  return dicts[l][key] ?? ru[key] ?? key;
}

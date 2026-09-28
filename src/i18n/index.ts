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

/** Translate into a specific language (e.g. Russian speech when no Kazakh voice exists). */
export function tIn(l: Lang, key: I18nKey): string {
  return dicts[l][key] ?? ru[key] ?? key;
}

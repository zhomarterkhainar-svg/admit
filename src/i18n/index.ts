import { ru, type I18nKey } from './ru';

export type { I18nKey };
export type Lang = 'ru' | 'kk' | 'en';

const dicts: Record<Lang, Partial<Record<I18nKey, string>>> = { ru, kk: {}, en: {} };

let lang: Lang = 'ru';

export const setLang = (l: Lang) => {
  lang = l;
};
export const getLang = () => lang;

/** Registers a (possibly partial) dictionary, e.g. lazily loaded kk/en. */
export const registerDict = (l: Lang, d: Partial<Record<I18nKey, string>>) => {
  dicts[l] = { ...dicts[l], ...d };
};

export function t(key: I18nKey): string {
  return dicts[lang][key] ?? ru[key] ?? key;
}

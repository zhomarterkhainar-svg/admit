import { afterEach, describe, expect, it } from 'vitest';
import { ru } from './ru';
import { en } from './en';
import { kk } from './kk';
import { setLang, t } from '.';

describe('i18n', () => {
  afterEach(() => setLang('ru'));

  it('kk and en cover every key', () => {
    for (const k of Object.keys(ru)) {
      expect(en, k).toHaveProperty(k);
      expect(kk, k).toHaveProperty(k);
    }
  });

  it('switches language', () => {
    expect(t('ui.start')).toBe('Начать');
    setLang('kk');
    expect(t('ui.start')).toBe('Бастау');
    setLang('en');
    expect(t('ui.start')).toBe('Start');
  });

  it('every hint has a non-empty fix in every language', () => {
    for (const d of [ru, en, kk] as Record<string, string>[]) {
      for (const k of Object.keys(ru).filter((k) => k.endsWith('.msg'))) {
        expect(d[k.replace(/\.msg$/, '.fix')]?.length, k).toBeGreaterThan(5);
      }
    }
  });
});

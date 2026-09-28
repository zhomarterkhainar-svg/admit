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

describe('plural', () => {
  afterEach(() => setLang('ru'));
  it('russian day forms', async () => {
    const { plural } = await import('.');
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => `${n} ${plural(n, 'streak.days')}`)).toEqual([
      '1 день подряд',
      '2 дня подряд',
      '5 дней подряд',
      '11 дней подряд',
      '21 день подряд',
      '22 дня подряд',
      '25 дней подряд',
    ]);
    setLang('en');
    expect(plural(1, 'streak.days')).toBe('day in a row');
    expect(plural(3, 'streak.days')).toBe('days in a row');
  });
});

import { describe, expect, it } from 'vitest';
import { withoutKicker } from './HintBanner';

describe('withoutKicker', () => {
  it('drops a prefix that repeats the kicker', () => {
    expect(withoutKicker('Не засчитано: неглубокий присед', 'Не засчитано')).toBe(
      'Неглубокий присед',
    );
    expect(withoutKicker('Not counted: squat too shallow', 'Not counted')).toBe(
      'Squat too shallow',
    );
    expect(withoutKicker('Есептелмеді: тым таяз отырдың', 'Есептелмеді')).toBe('Тым таяз отырдың');
  });
  it('keeps other messages as they are', () => {
    expect(withoutKicker('Колени заваливаются внутрь', 'Техника')).toBe(
      'Колени заваливаются внутрь',
    );
  });
});

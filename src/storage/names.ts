// Legendary Kazakh batyrs — the player gets a name without typing (no keyboard!).
const BATYRS = [
  'Қабанбай',
  'Бөгенбай',
  'Наурызбай',
  'Райымбек',
  'Жәнібек',
  'Исатай',
  'Махамбет',
  'Қобыланды',
  'Алпамыс',
  'Ер Тарғын',
  'Қамбар',
  'Ағыбай',
  'Олжабай',
  'Баян',
  'Тұмар',
  'Гүлбаршын',
];

/** Four random digits, so two players with the same batyr name are still told apart. */
const digits = (rand: () => number) => 1000 + Math.floor(rand() * 9000);

/** Given on the very first visit, e.g. «Қабанбай-4821». Can be changed in the profile. */
export function randomBatyrName(rand: () => number = Math.random): string {
  const name = BATYRS[Math.floor(rand() * BATYRS.length)]!;
  return `${name}-${digits(rand)}`;
}

export const NICK_MIN = 2;
export const NICK_MAX = 20;

/**
 * A typed nickname, cleaned: trimmed, inner spaces collapsed, only letters (any alphabet),
 * digits, space, dash, underscore and dot. Null when too short or too long.
 */
export function cleanNickname(input: string): string | null {
  const s = input
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length >= NICK_MIN && s.length <= NICK_MAX ? s : null;
}

export function nextBatyrName(
  current: string,
  dir: 1 | -1,
  rand: () => number = Math.random,
): string {
  const base = current.replace(/-\d+$/, '');
  const i = BATYRS.indexOf(base);
  const next = BATYRS[(i + dir + BATYRS.length) % BATYRS.length]!;
  return `${next}-${digits(rand)}`;
}

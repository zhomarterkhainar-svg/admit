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

export function randomBatyrName(rand: () => number = Math.random): string {
  const name = BATYRS[Math.floor(rand() * BATYRS.length)]!;
  const num = 10 + Math.floor(rand() * 90);
  return `${name}-${num}`;
}

export function nextBatyrName(
  current: string,
  dir: 1 | -1,
  rand: () => number = Math.random,
): string {
  const base = current.replace(/-\d+$/, '');
  const i = BATYRS.indexOf(base);
  const next = BATYRS[(i + dir + BATYRS.length) % BATYRS.length]!;
  return `${next}-${10 + Math.floor(rand() * 90)}`;
}

/**
 * Barys — the snow-leopard coach (the snow leopard is a national symbol of Kazakhstan).
 * Flat, Duolingo-like vector drawn as an SVG string so the same art works in <img> (UI)
 * and on a canvas (share card).
 */
export type Mood = 'happy' | 'wave' | 'cheer' | 'oops' | 'think' | 'sad';

const FUR = '#EEF2F7';
const FUR_SHADE = '#D5DDE8';
const SPOT = '#5B6778';
const INK = '#3C3C3C';
const PINK = '#FF8FA3';
const GREEN = '#58CC02';
const GREEN_DARK = '#46A302';
const GOLD = '#FFC800';
const GOLD_DARK = '#E0A800';

const arm = (cx: number, cy: number, rot: number) =>
  `<g transform="rotate(${rot} ${cx} ${cy})">` +
  `<ellipse cx="${cx}" cy="${cy}" rx="13" ry="25" fill="${FUR}"/>` +
  `<ellipse cx="${cx}" cy="${cy + 17}" rx="11" ry="8" fill="${FUR_SHADE}"/>` +
  `</g>`;

function arms(mood: Mood): string {
  switch (mood) {
    case 'wave':
      return arm(56, 172, 25) + arm(158, 122, -150);
    case 'cheer':
      return arm(44, 124, 150) + arm(156, 124, -150);
    case 'oops':
      return arm(56, 172, 25) + arm(152, 70, -160);
    default:
      return arm(56, 172, 25) + arm(144, 172, -25);
  }
}

function eyes(mood: Mood): string {
  if (mood === 'cheer' || mood === 'happy') {
    // closed, smiling eyes: ^ ^
    return (
      `<path d="M62 100 Q76 84 90 100" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
      `<path d="M110 100 Q124 84 138 100" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`
    );
  }
  const look =
    mood === 'think' ? { dx: 4, dy: -5 } : mood === 'oops' ? { dx: -2, dy: 2 } : { dx: 1, dy: 1 };
  const eye = (cx: number) =>
    `<ellipse cx="${cx}" cy="96" rx="17" ry="19" fill="#fff"/>` +
    `<circle cx="${cx + look.dx}" cy="${97 + look.dy}" r="11.5" fill="#7ACFC0"/>` +
    `<circle cx="${cx + look.dx}" cy="${97 + look.dy}" r="7" fill="${INK}"/>` +
    `<circle cx="${cx + look.dx - 3.5}" cy="${93 + look.dy}" r="3.6" fill="#fff"/>`;
  let brows = '';
  if (mood === 'oops' || mood === 'sad')
    brows =
      `<path d="M62 74 L86 80" stroke="${SPOT}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M138 74 L114 80" stroke="${SPOT}" stroke-width="5" stroke-linecap="round"/>`;
  return eye(76) + eye(124) + brows;
}

function mouth(mood: Mood): string {
  if (mood === 'cheer' || mood === 'wave')
    return (
      `<path d="M86 124 Q100 146 114 124 Z" fill="#7A2E3A" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M92 134 Q100 142 108 134 Q100 128 92 134 Z" fill="${PINK}"/>`
    );
  if (mood === 'oops') return `<ellipse cx="100" cy="130" rx="6" ry="7" fill="#7A2E3A"/>`;
  if (mood === 'sad')
    return `<path d="M88 134 Q100 124 112 134" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  return (
    `<path d="M100 120 v5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M100 125 q-7 8 -14 2 M100 125 q7 8 14 2" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`
  );
}

export function mascotSvg(mood: Mood = 'happy'): string {
  const sweat =
    mood === 'oops'
      ? `<path d="M170 64 q8 12 0 18 q-8 -6 0 -18 Z" fill="#84D8FF" stroke="#1CB0F6" stroke-width="2"/>`
      : '';
  const sparkles =
    mood === 'cheer'
      ? `<path d="M22 70 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill="${GOLD}"/>` +
        `<path d="M178 34 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z" fill="${GOLD}"/>`
      : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">
<path d="M136 190 C192 196 204 132 172 116" stroke="${FUR_SHADE}" stroke-width="24" fill="none" stroke-linecap="round"/>
<path d="M136 186 C186 190 196 136 170 122" stroke="${FUR}" stroke-width="18" fill="none" stroke-linecap="round"/>
<circle cx="182" cy="150" r="4.5" fill="${SPOT}"/><circle cx="172" cy="176" r="4" fill="${SPOT}"/><circle cx="178" cy="128" r="3.5" fill="${SPOT}"/>
<ellipse cx="80" cy="208" rx="18" ry="10" fill="${FUR_SHADE}"/>
<ellipse cx="120" cy="208" rx="18" ry="10" fill="${FUR_SHADE}"/>
<ellipse cx="100" cy="172" rx="46" ry="40" fill="${FUR}"/>
<ellipse cx="100" cy="182" rx="28" ry="26" fill="#fff"/>
<circle cx="66" cy="160" r="3.5" fill="${SPOT}"/><circle cx="134" cy="160" r="3.5" fill="${SPOT}"/><circle cx="72" cy="186" r="3" fill="${SPOT}"/><circle cx="128" cy="186" r="3" fill="${SPOT}"/>
${arms(mood)}
<circle cx="48" cy="42" r="19" fill="${SPOT}"/><circle cx="152" cy="42" r="19" fill="${SPOT}"/>
<circle cx="50" cy="44" r="11" fill="#F7C3CD"/><circle cx="150" cy="44" r="11" fill="#F7C3CD"/>
<ellipse cx="100" cy="94" rx="66" ry="58" fill="${FUR_SHADE}"/>
<ellipse cx="100" cy="90" rx="66" ry="55" fill="${FUR}"/>
<path d="M36 76 Q100 40 164 76 L162 92 Q100 58 38 92 Z" fill="${GREEN}"/>
<path d="M38 88 Q100 56 162 88 L162 92 Q100 60 38 92 Z" fill="${GREEN_DARK}"/>
<path d="M160 80 l20 -8 l-4 12 l8 8 l-20 -2 Z" fill="${GREEN}"/>
<path d="M100 50 c-6 0 -9 5 -7 9 c2 4 7 3 7 -1 M100 50 c6 0 9 5 7 9 c-2 4 -7 3 -7 -1" stroke="${GOLD}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
<circle cx="100" cy="64" r="4" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="1.5"/>
<ellipse cx="84" cy="36" rx="5" ry="4" fill="${SPOT}"/><ellipse cx="100" cy="32" rx="4" ry="3.5" fill="${SPOT}"/><ellipse cx="116" cy="36" rx="5" ry="4" fill="${SPOT}"/>
<circle cx="42" cy="104" r="3.5" fill="${SPOT}"/><circle cx="48" cy="116" r="3" fill="${SPOT}"/><circle cx="158" cy="104" r="3.5" fill="${SPOT}"/><circle cx="152" cy="116" r="3" fill="${SPOT}"/>
${eyes(mood)}
<ellipse cx="100" cy="124" rx="26" ry="17" fill="#fff"/>
<ellipse cx="62" cy="120" rx="9" ry="5.5" fill="#FFB3C1" opacity="0.7"/><ellipse cx="138" cy="120" rx="9" ry="5.5" fill="#FFB3C1" opacity="0.7"/>
<path d="M92 112 Q100 108 108 112 Q104 120 100 120 Q96 120 92 112 Z" fill="${PINK}"/>
${mouth(mood)}
${sweat}${sparkles}
</svg>`;
}

const cache = new Map<Mood, string>();

/** data: URL for <img src> / canvas drawImage. */
export function mascotUrl(mood: Mood = 'happy'): string {
  let url = cache.get(mood);
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mascotSvg(mood))}`;
    cache.set(mood, url);
  }
  return url;
}

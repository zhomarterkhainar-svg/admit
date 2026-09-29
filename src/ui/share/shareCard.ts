import { t } from '@/i18n';
import type { WorkoutSummary } from '@/game/summary';
import type { Rank } from '@/game/ranks';
import { mascotUrl } from '../mascot/mascot';

export interface CardData {
  playerName: string;
  rank: Rank;
  totalXp: number;
  summary: WorkoutSummary;
}

const W = 1080;
const H = 1350;
const MAX_TEXT = W - 160;
const FAMILY = `'Nunito Variable', Nunito, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const font = (size: number, weight = 800) => `${weight} ${size}px ${FAMILY}`;

const C = {
  green: '#58cc02',
  greenD: '#58a700',
  ink: '#3c3c3c',
  ink2: '#777777',
  line: '#e5e5e5',
  gold: '#ffc800',
  goldD: '#e5a500',
  purple: '#ce82ff',
  blue: '#1cb0f6',
  orange: '#ff9600',
  red: '#ff4b4b',
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Renders a 1080×1350 social card (Instagram portrait) with the workout summary. */
export async function renderCard(d: CardData): Promise<HTMLCanvasElement> {
  // canvas text does not wait for web fonts on its own
  await Promise.all([
    document.fonts?.load(font(64, 900)),
    document.fonts?.load(font(30, 800)),
  ]).catch(() => undefined);
  const mascot = await loadImage(mascotUrl('cheer'));

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // green header band with the logo
  ctx.fillStyle = C.green;
  roundRect(ctx, 0, 0, W, 330, 0);
  ctx.fill();
  ctx.fillStyle = C.greenD;
  ctx.fillRect(0, 318, W, 12);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = font(96, 900);
  ctx.fillText('qozğal', 70, 150);
  ctx.font = font(34, 800);
  wrap(ctx, t('app.tagline'), 70, 212, 560, 44);
  if (mascot) ctx.drawImage(mascot, W - 400, 30, 330, 363);

  ctx.textAlign = 'center';
  ctx.fillStyle = C.goldD;
  ctx.font = font(64, 900);
  ctx.fillText(t('results.done'), W / 2, 470, MAX_TEXT);
  ctx.fillStyle = C.ink;
  ctx.font = font(52, 900);
  ctx.fillText(d.playerName, W / 2, 560, MAX_TEXT);
  ctx.fillStyle = C.ink2;
  ctx.font = font(32, 800);
  ctx.fillText(`${t(d.rank.key)} · ${d.totalXp} XP`, W / 2, 610);

  const s = d.summary;
  const stats: [string, string, string][] = [
    [`+${s.xp}`, t('results.xp'), C.gold],
    [`${s.counted}/${s.attempted}`, t('results.reps'), C.purple],
    [`${s.cleanPct}%`, t('results.clean'), C.green],
    [`${s.quality}`, t('results.quality'), C.orange],
    [s.smoothness !== null ? `${s.smoothness}%` : '—', t('results.smoothness'), C.blue],
    [`~${s.kcal}`, t('results.kcal'), C.red],
  ];
  stats.forEach(([value, label, color], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const w = 290;
    const x = 70 + col * (w + 25);
    const y = 680 + row * 230;
    // Duolingo stat tile: coloured frame + label strip, white body
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, 200, 28);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = font(26, 900);
    ctx.fillText(label.toUpperCase(), x + w / 2, y + 40, w - 30);
    roundRect(ctx, x + 5, y + 58, w - 10, 137, 24);
    ctx.fill();
    ctx.fillStyle = color === C.gold ? C.goldD : color;
    ctx.font = font(72, 900);
    ctx.fillText(value, x + w / 2, y + 152, w - 30);
  });

  ctx.fillStyle = C.green;
  ctx.font = font(40, 900);
  const line =
    s.bestCleanStreak >= 3 ? `${s.bestCleanStreak} ${t('workout.cleanStreak')}` : t('praise.fixed');
  ctx.fillText(line, W / 2, 1200, MAX_TEXT);
  ctx.fillStyle = C.ink2;
  ctx.font = font(30, 800);
  ctx.fillText(new Date(s.startedAt).toLocaleDateString(), W / 2, 1270);
  return c;
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  max: number,
  lh: number,
) {
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Web Share (phones) with a PNG file; falls back to downloading the image. */
export async function shareCard(d: CardData): Promise<'shared' | 'downloaded'> {
  const canvas = await renderCard(d);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('toBlob failed');
  const file = new File([blob], 'qozgal.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'QOZĞAL', text: t('app.tagline') });
      return 'shared';
    } catch {
      /* cancelled or not allowed without a click (dwell) → download instead */
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'qozgal.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}

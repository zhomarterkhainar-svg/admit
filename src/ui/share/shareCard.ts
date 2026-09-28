import { t } from '@/i18n';
import type { WorkoutSummary } from '@/game/summary';
import type { Rank } from '@/game/ranks';

export interface CardData {
  playerName: string;
  rank: Rank;
  totalXp: number;
  summary: WorkoutSummary;
}

const W = 1080;
const H = 1350;
/** text never crosses the gold frame */
const MAX_TEXT = W - 180;

/** Renders a 1080×1350 social card (Instagram portrait) with the workout summary. */
export function renderCard(d: CardData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#141b33');
  g.addColorStop(1, '#0b1020');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // gold frame
  ctx.strokeStyle = '#ffc72c';
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  const font = (size: number, weight = 800) =>
    `${weight} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc72c';
  ctx.font = font(120, 900);
  ctx.fillText('QOZĞAL', W / 2, 200);
  ctx.fillStyle = '#9aa4c7';
  ctx.font = font(36, 600);
  ctx.fillText(t('app.tagline'), W / 2, 260, MAX_TEXT);

  ctx.fillStyle = '#f4f6ff';
  ctx.font = font(64);
  ctx.fillText(`${d.rank.icon} ${d.playerName}`, W / 2, 380, MAX_TEXT);
  ctx.fillStyle = '#9aa4c7';
  ctx.font = font(34, 600);
  ctx.fillText(`${t(d.rank.key)} · ${d.totalXp} XP`, W / 2, 430);

  const s = d.summary;
  const stats: [string, string][] = [
    [`${s.counted}/${s.attempted}`, t('results.reps')],
    [`${s.cleanPct}%`, t('results.clean')],
    [`${s.quality}`, t('results.quality')],
    [s.smoothness !== null ? `${s.smoothness}%` : '—', t('results.smoothness')],
    [`~${s.kcal}`, t('results.kcal')],
    [`+${s.xp}`, t('results.xp')],
  ];
  stats.forEach(([value, label], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 120 + col * 440;
    const y = 520 + row * 190;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, x, y, 400, 160, 28);
    ctx.fill();
    ctx.fillStyle = i === 5 ? '#ffc72c' : '#f4f6ff';
    ctx.font = font(80, 900);
    ctx.fillText(value, x + 200, y + 95);
    ctx.fillStyle = '#9aa4c7';
    ctx.font = font(30, 600);
    ctx.fillText(label, x + 200, y + 138, 370);
  });

  ctx.fillStyle = '#2ee59d';
  ctx.font = font(40);
  const line =
    s.bestCleanStreak >= 3
      ? `🔥 ${s.bestCleanStreak} ${t('workout.cleanStreak')}`
      : t('praise.fixed');
  ctx.fillText(line, W / 2, 1150, MAX_TEXT);
  ctx.fillStyle = '#9aa4c7';
  ctx.font = font(30, 600);
  ctx.fillText(new Date(s.startedAt).toLocaleDateString(), W / 2, 1230);
  return c;
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
  const canvas = renderCard(d);
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

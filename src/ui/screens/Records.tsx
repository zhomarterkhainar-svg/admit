import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Earth,
  Smartphone,
  Swords,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { rankFor } from '@/game/ranks';
import { ACHIEVEMENTS } from '@/game/achievements';
import { nextBatyrName } from '@/storage/names';
import {
  LocalLeaderboard,
  globalLeaderboard,
  type LeaderboardEntry,
  type Mode,
  type Period,
} from '@/storage/leaderboard';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { ProgressBar } from '../components/ProgressBar';
import { GameIcon } from '../components/icons';

const AVATAR_COLORS = ['#58cc02', '#1cb0f6', '#ff9600', '#ce82ff', '#ff4b4b', '#ffc800'];
const avatarColor = (name: string) =>
  AVATAR_COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 6]!;

export function Records() {
  const { progress, playerName, setPlayerName, go } = useApp();
  const changeName = (dir: 1 | -1) => setPlayerName(nextBatyrName(playerName, dir));
  useGestures({
    crossArms: () => go('menu'),
    swipeLeft: () => changeName(-1),
    swipeRight: () => changeName(1),
  });
  const { rank, next, progress: rp } = rankFor(progress.totalXp);
  const history = progress.history.slice(-12);
  const world = useMemo(() => globalLeaderboard(), []);
  const [source, setSource] = useState<'global' | 'local'>(world ? 'global' : 'local');
  const [period, setPeriod] = useState<Period>('all');
  const unlocked = Object.keys(progress.achievements).length;

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-head">
          <DwellButton
            variant="ghost"
            icon={<ArrowLeft size={22} strokeWidth={2.75} />}
            onSelect={() => go('menu')}
          >
            {t('back')}
          </DwellButton>
          <h1 className="h1">{t('records.title')}</h1>
          <div className="tabs">
            {(['today', 'week', 'all'] as Period[]).map((p) => (
              <DwellButton
                key={p}
                variant="ghost"
                active={p === period}
                onSelect={() => setPeriod(p)}
              >
                {t(`lb.${p}`)}
              </DwellButton>
            ))}
            {world && (
              <DwellButton
                variant="ghost"
                icon={
                  source === 'global' ? (
                    <Earth size={20} strokeWidth={2.75} />
                  ) : (
                    <Smartphone size={20} strokeWidth={2.75} />
                  )
                }
                onSelect={() => setSource(source === 'global' ? 'local' : 'global')}
              >
                {t(source === 'global' ? 'lb.world' : 'lb.device')}
              </DwellButton>
            )}
          </div>
        </div>

        <div className="records-grid">
          <div className="menu-side">
            <section className="card">
              <div className="name-row">
                <DwellButton variant="ghost" onSelect={() => changeName(-1)}>
                  <ChevronLeft size={24} strokeWidth={3} aria-label="←" />
                </DwellButton>
                <div className="player-big">
                  <span className="avatar" style={{ margin: '0 auto 6px' }} aria-hidden="true">
                    <GameIcon id={rank.icon} size={28} />
                  </span>
                  {playerName}
                  <span className="muted">
                    {t(rank.key)} · <span className="num">{progress.totalXp}</span> XP
                  </span>
                </div>
                <DwellButton variant="ghost" onSelect={() => changeName(1)}>
                  <ChevronRight size={24} strokeWidth={3} aria-label="→" />
                </DwellButton>
              </div>
              {next && (
                <ProgressBar value={rp} tone="gold" label={t(next.key)} className="rank-bar" />
              )}
            </section>
            <section className="card">
              <h2>
                <TrendingUp size={20} strokeWidth={2.75} color="var(--green)" />
                {t('records.progress')}
              </h2>
              {history.length < 2 ? (
                <p className="muted">{t('records.empty')}</p>
              ) : (
                <Sparkline values={history.map((h) => h.quality)} />
              )}
            </section>
          </div>
          <Board
            title={t('records.challenge')}
            icon={<Swords size={20} strokeWidth={2.75} color="var(--red)" />}
            mode="challenge"
            source={source}
            period={period}
            me={playerName}
          />
          <Board
            title={t('records.workout')}
            icon={<Dumbbell size={20} strokeWidth={2.75} color="var(--blue)" />}
            mode="workout"
            source={source}
            period={period}
            me={playerName}
          />
        </div>

        <section className="card">
          <h2>
            <Award size={20} strokeWidth={2.75} color="var(--gold-d)" />
            {t('ach.title')} · <span className="num">{unlocked}</span>/{ACHIEVEMENTS.length}
          </h2>
          <div className="ach-grid">
            {ACHIEVEMENTS.map((a) => (
              <div
                key={a.id}
                className={`ach ${progress.achievements[a.id] ? 'on' : ''}`}
                title={t(a.desc)}
              >
                <span className="ach-badge" aria-hidden="true">
                  <GameIcon id={a.icon} size={28} />
                </span>
                <b>{t(a.title)}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Loads the board from the chosen provider; falls back to this device if the world board fails. */
function Board(props: {
  title: string;
  icon: React.ReactNode;
  mode: Mode;
  source: 'global' | 'local';
  period: Period;
  me: string;
}) {
  const { title, icon, mode, source, period, me } = props;
  const progress = useApp((s) => s.progress);
  const [state, setState] = useState<{ rows: LeaderboardEntry[] | null; offline: boolean }>({
    rows: null,
    offline: false,
  });

  useEffect(() => {
    let alive = true;
    const local = new LocalLeaderboard(() => progress);
    const world = source === 'global' ? globalLeaderboard() : null;
    (world ?? local)
      .top(mode, period, 7)
      .then((rows) => alive && setState({ rows, offline: false }))
      .catch(() =>
        local.top(mode, period, 7).then((rows) => alive && setState({ rows, offline: true })),
      );
    return () => {
      alive = false;
    };
  }, [mode, source, period, progress]);

  const rows = state.rows;
  return (
    <section className="card">
      <h2>
        {icon}
        {title}
        {source === 'global' && !state.offline && (
          <Earth size={18} strokeWidth={2.75} color="var(--blue)" />
        )}
      </h2>
      {state.offline && <p className="muted">{t('lb.offline')}</p>}
      {rows === null ? (
        <p className="muted">…</p>
      ) : rows.length === 0 ? (
        <p className="muted">{t('records.empty')}</p>
      ) : (
        <ol className="scores">
          {rows.map((r, i) => (
            <li key={`${r.at}-${i}`} className={r.name === me ? 'me' : ''}>
              <span className={`place place-${i + 1}`}>{i + 1}</span>
              <span className="ava" style={{ background: avatarColor(r.name) }} aria-hidden="true">
                {[...r.name][0]?.toUpperCase()}
              </span>
              <span className="grow">{r.name}</span>
              <b className="score">{r.score}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Quality (0–100) of the last workouts: gridlines at 50/100, the latest point emphasized. */
function Sparkline({ values }: { values: number[] }) {
  const w = 300;
  const h = 100;
  const pad = 22;
  const pts = values.map(
    (v, i) => [pad + (i / (values.length - 1)) * (w - pad), h - (v / 100) * h] as const,
  );
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg
      viewBox={`-4 -8 ${w + 12} ${h + 16}`}
      className="sparkline"
      role="img"
      aria-label={`quality: ${values.join(', ')}`}
    >
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={pad} x2={w} y1={h - g} y2={h - g} className="spark-grid" />
          <text x={0} y={h - g + 4} className="spark-label">
            {g}
          </text>
        </g>
      ))}
      <path d={`${d} L${w},${h} L${pad},${h} Z`} className="spark-area" />
      <path d={d} className="spark-line" />
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === pts.length - 1 ? 6 : 4}
          className={`spark-dot ${i === pts.length - 1 ? 'last' : ''}`}
        />
      ))}
    </svg>
  );
}

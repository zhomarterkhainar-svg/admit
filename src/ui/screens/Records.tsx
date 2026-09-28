import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { rankFor } from '@/game/ranks';
import { ACHIEVEMENTS } from '@/game/achievements';
import { nextBatyrName } from '@/storage/names';
import { useEffect, useMemo, useState } from 'react';
import {
  LocalLeaderboard,
  globalLeaderboard,
  type LeaderboardEntry,
  type Mode,
  type Period,
} from '@/storage/leaderboard';
import { useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { OverlayCanvas } from '../overlay/OverlayCanvas';

export function Records() {
  const loop = useLoop();
  const { progress, playerName, setPlayerName, go } = useApp();
  const changeName = (dir: 1 | -1) => setPlayerName(nextBatyrName(playerName, dir));
  useGestures({
    crossArms: () => go('menu'),
    swipeLeft: () => changeName(-1),
    swipeRight: () => changeName(1),
  });
  const { rank } = rankFor(progress.totalXp);
  const history = progress.history.slice(-12);
  const world = useMemo(() => globalLeaderboard(), []);
  const [source, setSource] = useState<'global' | 'local'>(world ? 'global' : 'local');
  const [period, setPeriod] = useState<Period>('all');

  return (
    <>
      <OverlayCanvas loop={loop} />
      <div className="screen-dim results">
        <h1 className="h1">{t('records.title')}</h1>
        <div className="name-row">
          <DwellButton variant="ghost" onSelect={() => changeName(-1)}>
            ◀
          </DwellButton>
          <div className="player-big">
            <span className="rank-icon">{rank.icon}</span> {playerName}
            <div className="muted">
              {t(rank.key)} · {t('records.totalXp')}: {progress.totalXp}
            </div>
          </div>
          <DwellButton variant="ghost" onSelect={() => changeName(1)}>
            ▶
          </DwellButton>
        </div>

        <div className="tabs">
          {(['today', 'week', 'all'] as Period[]).map((p) => (
            <DwellButton
              key={p}
              variant={p === period ? 'primary' : 'ghost'}
              onSelect={() => setPeriod(p)}
            >
              {t(`lb.${p}`)}
            </DwellButton>
          ))}
          {world && (
            <DwellButton
              variant="ghost"
              icon={source === 'global' ? '🌍' : '📱'}
              onSelect={() => setSource(source === 'global' ? 'local' : 'global')}
            >
              {t(source === 'global' ? 'lb.world' : 'lb.device')}
            </DwellButton>
          )}
        </div>

        <div className="results-body">
          <Board
            title={t('records.challenge')}
            mode="challenge"
            source={source}
            period={period}
            me={playerName}
          />
          <Board
            title={t('records.workout')}
            mode="workout"
            source={source}
            period={period}
            me={playerName}
          />
          <section className="card">
            <h2>{t('records.progress')}</h2>
            {history.length < 2 ? (
              <p className="muted">{t('records.empty')}</p>
            ) : (
              <Sparkline values={history.map((h) => h.quality)} />
            )}
          </section>
        </div>

        <section className="card achievements">
          <h2>
            {t('ach.title')} · {Object.keys(progress.achievements).length}/{ACHIEVEMENTS.length}
          </h2>
          <div className="ach-grid">
            {ACHIEVEMENTS.map((a) => (
              <div
                key={a.id}
                className={`ach ${progress.achievements[a.id] ? 'on' : ''}`}
                title={t(a.desc)}
              >
                <span className="ach-icon">{a.icon}</span>
                <b>{t(a.title)}</b>
                <small>{t(a.desc)}</small>
              </div>
            ))}
          </div>
        </section>

        <DwellButton variant="ghost" icon="←" onSelect={() => go('menu')}>
          {t('back')}
        </DwellButton>
      </div>
    </>
  );
}

/** Loads the board from the chosen provider; falls back to this device if the world board fails. */
function Board(props: {
  title: string;
  mode: Mode;
  source: 'global' | 'local';
  period: Period;
  me: string;
}) {
  const { title, mode, source, period, me } = props;
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
        {title} {source === 'global' && !state.offline ? '🌍' : ''}
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
              <span>{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
              <span className="grow">{r.name}</span>
              <b>{r.score}</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 300;
  const h = 100;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - (v / 100) * h] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg
      viewBox={`-6 -6 ${w + 12} ${h + 12}`}
      className="sparkline"
      role="img"
      aria-label="quality trend"
    >
      <path d={`${d} L${w},${h} L0,${h} Z`} className="spark-area" />
      <path d={d} className="spark-line" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} className="spark-dot" />
      ))}
    </svg>
  );
}

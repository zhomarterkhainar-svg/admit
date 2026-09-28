import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { rankFor } from '@/game/ranks';
import { nextBatyrName } from '@/storage/names';
import { topScores, type ScoreEntry } from '@/storage/progress';
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

        <div className="results-body">
          <ScoreTable
            title={t('records.challenge')}
            rows={topScores(progress, 'challenge', 7)}
            me={playerName}
          />
          <ScoreTable
            title={t('records.workout')}
            rows={topScores(progress, 'workout', 7)}
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

        <DwellButton variant="ghost" icon="←" onSelect={() => go('menu')}>
          {t('back')}
        </DwellButton>
      </div>
    </>
  );
}

function ScoreTable({ title, rows, me }: { title: string; rows: ScoreEntry[]; me: string }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
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

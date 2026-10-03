import { useState } from 'react';
import { Activity, ArrowLeft, Award, Check, Dices, Pencil, TrendingUp, Wrench } from 'lucide-react';
import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { errorJourney } from '@/game/errorProgress';
import { ruleMessage } from '../ruleMessage';
import { ErrorTrend } from '../components/ErrorTrend';

import { rankFor } from '@/game/ranks';
import { ACHIEVEMENTS } from '@/game/achievements';
import { topScores } from '@/storage/progress';
import { NICK_MAX, cleanNickname, nextBatyrName, randomBatyrName } from '@/storage/names';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { ProgressBar } from '../components/ProgressBar';
import { GameIcon } from '../components/icons';
import { avatarColor } from './Records';

/** The player: nickname (type it, or roll a random batyr), rank, lifetime stats, badges. */
export function Profile() {
  const { progress, playerName, setPlayerName, go } = useApp();
  const [draft, setDraft] = useState(playerName);
  const [status, setStatus] = useState<'idle' | 'saved' | 'bad'>('idle');
  const rename = (name: string) => {
    setPlayerName(name);
    setDraft(name);
    setStatus('saved');
  };
  // no keyboard in front of the camera: swipes cycle through batyr names
  useGestures({
    crossArms: () => go('menu'),
    swipeLeft: () => rename(nextBatyrName(playerName, -1)),
    swipeRight: () => rename(nextBatyrName(playerName, 1)),
  });

  const save = () => {
    const clean = cleanNickname(draft);
    if (!clean) return setStatus('bad');
    rename(clean);
  };

  const { rank, next, progress: rp } = rankFor(progress.totalXp);
  const s = progress.stats;
  const bestChallenge = Math.max(
    0,
    ...topScores(progress, 'challenge', 50)
      .filter((e) => e.name === playerName)
      .map((e) => e.score),
  );
  const history = progress.history.slice(-12);
  const journey = errorJourney(progress.history);
  const unlocked = Object.keys(progress.achievements).length;
  const stats: [string, number][] = [
    [t('profile.workouts'), s.workouts],
    [t('profile.reps'), s.totalReps],
    [t('profile.bestChallenge'), bestChallenge],
    [t('profile.streak'), progress.streak.days],
  ];

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
          <h1 className="h1">{t('profile.title')}</h1>
        </div>

        <div className="profile-grid">
          <section className="card profile-card">
            <span
              className="profile-ava"
              style={{ background: avatarColor(playerName) }}
              aria-hidden="true"
            >
              {[...playerName][0]?.toUpperCase()}
              <span className="profile-rank-badge">
                <GameIcon id={rank.icon} size={22} />
              </span>
            </span>
            <div className="profile-big-name">{playerName}</div>
            <div className="muted">
              {t(rank.key)} · <span className="num">{progress.totalXp}</span> XP
            </div>
            {next && (
              <ProgressBar value={rp} tone="gold" label={t(next.key)} className="rank-bar" />
            )}

            <form
              className="nick-form"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label className="kicker" htmlFor="nick">
                <Pencil size={14} strokeWidth={3} /> {t('profile.nick')}
              </label>
              <div className="nick-row">
                <input
                  id="nick"
                  className={`nick-input ${status === 'bad' ? 'bad' : ''}`}
                  value={draft}
                  maxLength={NICK_MAX}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setStatus('idle');
                  }}
                />
                <button
                  type="submit"
                  className={`btn nick-save ${status === 'saved' ? 'saved' : ''}`}
                  disabled={draft.trim() === playerName}
                  aria-label={t('profile.save')}
                  title={t('profile.save')}
                >
                  <Check size={26} strokeWidth={3.5} />
                </button>
              </div>
              <p className={`nick-help ${status === 'bad' ? 'bad' : ''}`}>
                {t(status === 'bad' ? 'profile.nickBad' : 'profile.nickHelp')}
              </p>
            </form>
            <DwellButton
              icon={<Activity size={22} strokeWidth={2.5} />}
              tone="blue"
              sub={t('moves.openSub')}
              onSelect={() => go('moves')}
            >
              {t('moves.open')}
            </DwellButton>
            <DwellButton
              icon={<Dices size={22} strokeWidth={2.5} />}
              tone="purple"
              sub={t('profile.randomSub')}
              onSelect={() => rename(randomBatyrName())}
            >
              {t('profile.random')}
            </DwellButton>
          </section>

          <div className="profile-side">
            <section className="profile-stats">
              {stats.map(([label, value]) => (
                <div key={label} className="profile-stat">
                  <b className="num">{value}</b>
                  <span>{label}</span>
                </div>
              ))}
            </section>

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
                      <GameIcon id={a.icon} size={26} />
                    </span>
                    <b>{t(a.title)}</b>
                  </div>
                ))}
              </div>
            </section>

            <div className="profile-pair">
              <section className="card">
                <h2>
                  <TrendingUp size={20} strokeWidth={2.75} color="var(--green)" />
                  {t('records.progress')}
                </h2>
                {history.length < 2 ? (
                  <p className="muted">{t('profile.noHistory')}</p>
                ) : (
                  <Sparkline values={history.map((h) => h.quality)} />
                )}
              </section>
              <section className="card">
                <h2>
                  <Wrench size={20} strokeWidth={2.75} color="var(--orange)" />
                  {t('progress.title')}
                </h2>
                {journey.length === 0 ? (
                  <p className="muted">{t('progress.empty')}</p>
                ) : (
                  <ul className="journey">
                    {journey.map((j) => (
                      <li key={j.id}>
                        <b>{ruleMessage(j.id)}</b>
                        <ErrorTrend
                          before={j.first}
                          now={j.last}
                          labels={['progress.first', 'progress.last']}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
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

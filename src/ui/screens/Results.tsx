import { useEffect } from 'react';
import { useApp } from '@/app/store';
import { t, type I18nKey } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { EXERCISES } from '@/exercises/registry';
import { rankFor } from '@/game/ranks';
import { useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { Confetti } from '../components/Confetti';
import { PoseCompare } from '../components/PoseCompare';
import { shareCard } from '../share/shareCard';

const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Rule id → its fix text, looked up across all exercises. */
function fixFor(id: string): { msg: I18nKey; fix: I18nKey; joints: readonly number[] } | null {
  for (const ex of Object.values(EXERCISES)) {
    const r = [...ex.frameRules, ...ex.repRules].find((x) => x.id === id);
    if (r) return { msg: r.message, fix: r.fix, joints: r.joints };
  }
  return null;
}

export function Results() {
  const loop = useLoop();
  const { summary, xpBefore, progress, program, startProgram, go, questCompleted, playerName } =
    useApp();
  useGestures({ crossArms: () => go('menu') });

  const before = rankFor(xpBefore);
  const after = rankFor(progress.totalXp);
  const rankUp = after.rank.key !== before.rank.key;

  useEffect(() => {
    if (!summary) return;
    if (rankUp) sfx.perfect();
    const top = summary.topErrors[0] && fixFor(summary.topErrors[0].id);
    speak(
      (tr) =>
        `${tr('results.title')}. ${tr('results.reps')}: ${summary.counted}. ${tr('results.quality')}: ${summary.quality}%. ` +
        (top ? `${tr(top.msg)}. ${tr(top.fix)}` : tr('results.noErrors')),
    );
  }, [summary, rankUp]);

  if (!summary) return null;

  return (
    <>
      <OverlayCanvas loop={loop} />
      {(rankUp || summary.cleanPct === 100) && <Confetti />}
      <div className="screen-dim results">
        <h1 className="h1">{t('results.title')}</h1>
        <div className="stats">
          <Stat label={t('results.reps')} value={`${summary.counted}/${summary.attempted}`} />
          <Stat label={t('results.clean')} value={`${summary.cleanPct}%`} />
          <Stat label={t('results.quality')} value={`${summary.quality}`} />
          {summary.smoothness !== null && (
            <Stat label={t('results.smoothness')} value={`${summary.smoothness}%`} />
          )}
          <Stat label={t('results.time')} value={fmtTime(summary.durationMs)} />
          <Stat label={t('results.kcal')} value={`~${summary.kcal}`} />
          <Stat label={t('results.xp')} value={`+${summary.xp}`} accent />
        </div>

        <div className="results-body">
          <section className="card">
            <table className="ex-table">
              <tbody>
                {summary.results.map((r, i) => {
                  const counted = r.reps.filter((x) => x.counted).length;
                  const clean = r.reps.filter((x) => x.counted && x.errors.length === 0).length;
                  return (
                    <tr key={i}>
                      <td>{t(EXERCISES[r.id].name)}</td>
                      <td>
                        {counted}
                        {r.target > 0 && `/${r.target}`}
                      </td>
                      <td className="bar-cell">
                        <div className="mini-bar">
                          <div
                            style={{
                              width: `${r.reps.length ? (clean / r.reps.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="card">
            <h2>{t('results.topErrors')}</h2>
            {summary.attempted === 0 ? (
              <p className="muted">—</p>
            ) : summary.topErrors.length === 0 ? (
              <p className="lead">{t('results.noErrors')}</p>
            ) : (
              <ol className="errors">
                {summary.topErrors.map((e, i) => {
                  const f = fixFor(e.id);
                  return (
                    <li key={e.id} className={i === 0 ? 'with-compare' : ''}>
                      <div>
                        <b>
                          {i + 1}. {f ? t(f.msg) : e.id}
                        </b>{' '}
                        · {e.count} {t('results.times')}
                        {f && <div className="muted">💡 {t(f.fix)}</div>}
                      </div>
                      {i === 0 && <PoseCompare ruleId={e.id} joints={f?.joints} />}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {questCompleted && (
          <div className="quest-done">
            📜 {t('quest.done')} +{questCompleted.xp} XP
          </div>
        )}
        <div className={`rank-line ${rankUp ? 'rank-up' : ''}`}>
          {summary.bestCleanStreak >= 3 && (
            <span className="muted">
              🔥 {summary.bestCleanStreak} {t('workout.cleanStreak')} ·{' '}
            </span>
          )}
          <span className="rank-icon">{after.rank.icon}</span>
          {rankUp && <b>{t('results.rankUp')} </b>}
          {t(after.rank.key)} · {progress.totalXp} XP
          {after.next && (
            <span className="muted">
              {' '}
              · {after.next.minXp - progress.totalXp} XP {t('results.toNext')} «{t(after.next.key)}»
            </span>
          )}
        </div>

        <div className="menu-row">
          <DwellButton
            variant="primary"
            icon="↻"
            onSelect={() =>
              summary.programId === 'free' ? go('free') : program && startProgram({ ...program })
            }
          >
            {t('results.again')}
          </DwellButton>
          <DwellButton icon="🏆" onSelect={() => go('records')}>
            {t('results.records')}
          </DwellButton>
          <DwellButton
            variant="ghost"
            icon="📤"
            onSelect={() =>
              void shareCard({ playerName, rank: after.rank, totalXp: progress.totalXp, summary })
            }
          >
            {t('results.share')}
          </DwellButton>
          <DwellButton variant="ghost" icon="🏠" onSelect={() => go('menu')}>
            {t('results.menu')}
          </DwellButton>
        </div>
      </div>
    </>
  );
}

export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`stat ${accent ? 'accent' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

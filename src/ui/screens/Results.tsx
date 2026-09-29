import { useEffect } from 'react';
import {
  Activity,
  Dumbbell,
  Flame,
  House,
  Lightbulb,
  RotateCcw,
  ScrollText,
  Share2,
  Star,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { useApp } from '@/app/store';
import { plural, t, type I18nKey } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { ALL_EXERCISES } from '@/exercises/registry';
import { rankFor } from '@/game/ranks';
import { errorProgress } from '@/game/errorProgress';
import { ErrorTrend } from '../components/ErrorTrend';
import { ErrorReplay } from '../components/ErrorReplay';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { Confetti } from '../components/Confetti';
import { Mascot } from '../components/Mascot';
import { PoseCompare } from '../components/PoseCompare';
import { ProgressBar } from '../components/ProgressBar';
import { StatBox } from '../components/StatBox';
import { GameIcon } from '../components/icons';
import { shareCard } from '../share/shareCard';

const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Rule id → its fix text, looked up across all exercises. */
function fixFor(id: string): { msg: I18nKey; fix: I18nKey; joints: readonly number[] } | null {
  for (const ex of Object.values(ALL_EXERCISES)) {
    const r = [...ex.frameRules, ...ex.repRules].find((x) => x.id === id);
    if (r) return { msg: r.message, fix: r.fix, joints: r.joints };
  }
  return null;
}

export function Results() {
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
  const perfect = summary.attempted > 0 && summary.topErrors.length === 0;
  // the session just finished is the last history entry
  const trends =
    progress.history.at(-1)?.at === summary.startedAt ? errorProgress(progress.history) : [];
  // slow-motion replay: the worst rep showing the top error if there is one, else any worst rep
  const replays = summary.results.flatMap((r) => (r.replay ? [r.replay] : []));
  const topId = summary.topErrors[0]?.id;
  const replay = replays.find((r) => r.ruleId === topId) ?? replays.find((r) => r.ruleId);
  const replayRule = replay?.ruleId ? fixFor(replay.ruleId) : null;

  return (
    <>
      {(rankUp || summary.cleanPct === 100) && <Confetti />}
      <div className="page">
        <div className="page-inner v-center">
          <div className="results-head">
            <Mascot mood={perfect || rankUp ? 'cheer' : 'happy'} size={110} bob />
            <div className="results-headline">
              <h1 className="results-title">{t('results.done')}</h1>
              {questCompleted && (
                <div className="quest-done">
                  <ScrollText size={18} strokeWidth={2.75} /> {t('quest.done')} +{questCompleted.xp}{' '}
                  XP
                </div>
              )}
            </div>
          </div>

          <div className="stats">
            <StatBox
              label={t('results.xp')}
              value={`+${summary.xp}`}
              color="gold"
              icon={<Zap size={24} strokeWidth={2.5} fill="currentColor" />}
            />
            <StatBox
              label={t('results.reps')}
              value={`${summary.counted}/${summary.attempted}`}
              color="purple"
              icon={<Dumbbell size={24} strokeWidth={2.5} />}
            />
            <StatBox
              label={t('results.clean')}
              value={`${summary.cleanPct}%`}
              color="green"
              icon={<Target size={24} strokeWidth={2.5} />}
            />
            <StatBox
              label={t('results.quality')}
              value={summary.quality}
              color="orange"
              icon={<Star size={24} strokeWidth={2.5} fill="currentColor" />}
            />
            {summary.smoothness !== null && (
              <StatBox
                label={t('results.smoothness')}
                value={`${summary.smoothness}%`}
                color="blue"
                icon={<Activity size={24} strokeWidth={2.5} />}
              />
            )}
            <StatBox
              label={t('results.time')}
              value={fmtTime(summary.durationMs)}
              sub={`~${summary.kcal} ${t('results.kcal')}`}
              color="red"
              icon={<Timer size={24} strokeWidth={2.5} />}
            />
          </div>

          <div className="results-body">
            <section className="card">
              <h2>
                <Dumbbell size={20} strokeWidth={2.75} color="var(--purple)" />{' '}
                {t('results.exercises')}
              </h2>
              <div className="ex-list">
                {summary.results.map((r, i) => {
                  const counted = r.reps.filter((x) => x.counted).length;
                  const clean = r.reps.filter((x) => x.counted && x.errors.length === 0).length;
                  return (
                    <div className="ex-row" key={i}>
                      <span>{t(ALL_EXERCISES[r.id].name)}</span>
                      <span className="num muted">
                        {counted}
                        {r.target > 0 && `/${r.target}`}
                        {ALL_EXERCISES[r.id].hold && ` ${t('workout.sec')}`}
                      </span>
                      <ProgressBar value={r.reps.length ? clean / r.reps.length : 0} />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2>
                <Lightbulb size={20} strokeWidth={2.75} color="var(--gold-d)" />
                {t('results.topErrors')}
              </h2>
              {summary.attempted === 0 ? (
                <p className="muted">—</p>
              ) : perfect ? (
                <div className="all-clean">
                  <Mascot mood="cheer" size={64} />
                  {t('results.noErrors')}
                </div>
              ) : (
                <ol className="errors">
                  {summary.topErrors.map((e, i) => {
                    const f = fixFor(e.id);
                    const trend = trends.find((x) => x.id === e.id);
                    return (
                      <li key={e.id}>
                        <div>
                          <div className="err-head">
                            <b>{f ? t(f.msg) : e.id}</b>
                            <span className="times num">
                              × {e.count} {plural(e.count, 'results.times')}
                            </span>
                            {trend && trend.before !== null && (
                            <ErrorTrend before={trend.before} now={trend.now} />
                          )}
                          </div>
                          {f && (
                            <div className="fix">
                              <Lightbulb size={16} strokeWidth={2.75} /> {t(f.fix)}
                            </div>
                          )}
                        </div>
                        {i === 0 &&
                          (replay && replayRule ? (
                            <ErrorReplay
                              replay={replay}
                              message={replayRule.msg}
                              fix={replayRule.fix}
                              joints={replayRule.joints}
                              caption={replay.ruleId !== e.id}
                            />
                          ) : (
                            <PoseCompare ruleId={e.id} joints={f?.joints} />
                          ))}
                      </li>
                    );
                  })}
                </ol>
              )}
              {summary.topErrors.some(
                (e) => trends.find((x) => x.id === e.id)?.before === null,
              ) && <ErrorTrend before={null} now={null} />}
            </section>
          </div>

          <div className={`rank-line ${rankUp ? 'rank-up' : ''}`}>
            <span className="avatar small" aria-hidden="true">
              <GameIcon id={after.rank.icon} size={22} />
            </span>
            {rankUp && <b>{t('results.rankUp')}</b>}
            <span>
              {t(after.rank.key)} · <span className="num">{progress.totalXp}</span> XP
            </span>
            {after.next && (
              <>
                <ProgressBar value={after.progress} tone="gold" />
                <span className="muted">
                  {after.next.minXp - progress.totalXp} XP {t('results.toNext')} «
                  {t(after.next.key)}»
                </span>
              </>
            )}
            {summary.bestCleanStreak >= 3 && (
              <span className="chip chip-orange">
                <Flame size={18} strokeWidth={2.75} fill="currentColor" />
                {summary.bestCleanStreak} {t('workout.cleanStreak')}
              </span>
            )}
          </div>

          <div className="menu-row">
            <DwellButton
              variant="primary"
              icon={<RotateCcw size={24} strokeWidth={2.75} />}
              onSelect={() =>
                summary.programId === 'free' ? go('free') : program && startProgram({ ...program })
              }
            >
              {t('results.again')}
            </DwellButton>
            <DwellButton
              icon={<Trophy size={24} strokeWidth={2.75} />}
              tone="gold"
              onSelect={() => go('records')}
            >
              {t('results.records')}
            </DwellButton>
            <DwellButton
              variant="blue"
              icon={<Share2 size={22} strokeWidth={2.75} />}
              onSelect={() =>
                void shareCard({ playerName, rank: after.rank, totalXp: progress.totalXp, summary })
              }
            >
              {t('results.share')}
            </DwellButton>
            <DwellButton
              variant="ghost"
              icon={<House size={22} strokeWidth={2.75} />}
              onSelect={() => go('menu')}
            >
              {t('results.menu')}
            </DwellButton>
          </div>
        </div>
      </div>
    </>
  );
}

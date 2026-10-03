import { useState } from 'react';
import { ArrowLeft, Activity, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '@/app/store';
import { plural, t, type I18nKey } from '@/i18n';
import { ALL_EXERCISES, type AnyExerciseId } from '@/exercises/registry';
import { movementProfile, type ExerciseProfile } from '@/game/movementProfile';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { ProgressBar } from '../components/ProgressBar';
import { ruleMessage } from '../ruleMessage';

/**
 * The player's individual movement profile, built up over time: per exercise the average depth
 * (and the key joint angle), range of motion, stability, tempo and the typical errors.
 */
export function MovementProfile() {
  const { progress, go } = useApp();
  const profile = movementProfile(progress.history);
  // no scrolling with a hand cursor: a few exercises per page, swipe or point to turn pages
  const pages = Math.max(1, Math.ceil(profile.length / PER_PAGE));
  const [page, setPage] = useState(0);
  const turn = (d: 1 | -1) => setPage((p) => (p + d + pages) % pages);
  useGestures({
    crossArms: () => go('profile'),
    swipeLeft: () => turn(1),
    swipeRight: () => turn(-1),
  });
  const shown = profile.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-head">
          <DwellButton
            variant="ghost"
            icon={<ArrowLeft size={22} strokeWidth={2.75} />}
            onSelect={() => go('profile')}
          >
            {t('back')}
          </DwellButton>
          <h1 className="h1">{t('moves.title')}</h1>
          {pages > 1 && (
            <div className="moves-pager">
              <DwellButton
                variant="ghost"
                icon={<ChevronLeft size={22} strokeWidth={2.75} />}
                onSelect={() => turn(-1)}
              >
                {t('moves.prev')}
              </DwellButton>
              <span className="num">
                {page + 1}/{pages}
              </span>
              <DwellButton
                variant="ghost"
                icon={<ChevronRight size={22} strokeWidth={2.75} />}
                onSelect={() => turn(1)}
              >
                {t('moves.next')}
              </DwellButton>
            </div>
          )}
        </div>
        {profile.length === 0 ? (
          <section className="card moves-empty">
            <Activity size={40} strokeWidth={2.5} color="var(--blue)" />
            <p>{t('moves.empty')}</p>
          </section>
        ) : (
          <>
            <p className="muted moves-intro">{t('moves.intro')}</p>
            <div className="moves-grid">
              {shown.map((p) => (
                <MoveCard key={p.id} p={p} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const PER_PAGE = 3;

function MoveCard({ p }: { p: ExerciseProfile }) {
  const ex = ALL_EXERCISES[p.id as AnyExerciseId];
  const tone = (v: number) => (v >= 75 ? 'green' : v >= 50 ? 'gold' : 'orange');
  return (
    <section className="card move-card">
      <h2>{ex ? t(ex.name) : p.id}</h2>
      <div className="muted move-count">
        <span className="num">{p.sessions}</span> {plural(p.sessions, 'moves.sessions')} ·{' '}
        <span className="num">{p.reps}</span> {plural(p.reps, 'moves.reps')}
      </div>

      <Metric label={t('moves.depth')} value={`${p.depthPct}%`}>
        <ProgressBar value={p.depthPct / 100} tone={tone(p.depthPct)} label={t('moves.depth')} />
        <div className="move-note">
          {p.angle !== undefined && ex?.angleLabel && (
            <span>
              {t(ex.angleLabel)}: <b className="num">{p.angle}°</b>
            </span>
          )}
          {p.depthTrend !== null && Math.abs(p.depthTrend) >= 3 && (
            <span className={`move-trend ${p.depthTrend > 0 ? 'up' : 'down'}`}>
              {p.depthTrend > 0 ? (
                <ArrowUp size={14} strokeWidth={3} />
              ) : (
                <ArrowDown size={14} strokeWidth={3} />
              )}
              {Math.abs(p.depthTrend)}% {t(p.depthTrend > 0 ? 'moves.trendUp' : 'moves.trendDown')}
            </span>
          )}
        </div>
      </Metric>

      <Metric label={t('moves.rom')} value={`${p.romPct}%`}>
        <ProgressBar value={p.romPct / 100} tone="blue" label={t('moves.rom')} />
      </Metric>

      <Metric label={t('moves.stability')} value={`${p.stability}/100`}>
        <ProgressBar
          value={p.stability / 100}
          tone={tone(p.stability)}
          label={t('moves.stability')}
        />
      </Metric>

      <Metric
        label={t('moves.tempo')}
        value={
          <>
            <span className="num">{p.repSec.toFixed(1)}</span> {t('moves.perRep')}
          </>
        }
      >
        <span className={`move-tempo tempo-${p.tempo}`}>
          {t(`moves.tempo.${p.tempo}` as I18nKey)}
        </span>
      </Metric>

      <div className="move-errors">
        <b>{t('moves.errors')}</b>
        {p.errors.length === 0 ? (
          <p className="muted">{t('moves.noErrors')}</p>
        ) : (
          <ul>
            {p.errors.map((e) => (
              <li key={e.id}>
                <span>{ruleMessage(e.id)}</span>
                <span className="move-rate num">
                  {Math.round(e.rate * 100)}% {t('moves.ofReps')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="move-metric">
      <div className="move-metric-head">
        <span>{label}</span>
        <b>{value}</b>
      </div>
      {children}
    </div>
  );
}

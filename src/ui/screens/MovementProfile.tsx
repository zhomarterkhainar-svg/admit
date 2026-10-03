import { useState } from 'react';
import { ArrowLeft, Activity, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '@/app/store';
import { plural, t, type I18nKey } from '@/i18n';
import { ALL_EXERCISES, type AnyExerciseId } from '@/exercises/registry';
import { movementProfile, type ExerciseProfile } from '@/game/movementProfile';
import { BODY_KEYS, bodyProfile, typicalErrors, type BodyStats } from '@/game/bodyProfile';
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
  const body = bodyProfile(progress.history);
  const hasBody = Object.keys(body).length > 0;
  // no scrolling with a hand cursor: the whole-body profile first, then a few exercises per
  // page; swipe or point to turn pages
  const first = hasBody ? 1 : 0;
  const pages = Math.max(1, first + Math.ceil(profile.length / PER_PAGE));
  const [page, setPage] = useState(0);
  const turn = (d: 1 | -1) => setPage((p) => (p + d + pages) % pages);
  useGestures({
    crossArms: () => go('profile'),
    swipeLeft: () => turn(1),
    swipeRight: () => turn(-1),
  });
  const onBody = hasBody && page === 0;
  const shown = profile.slice((page - first) * PER_PAGE, (page - first + 1) * PER_PAGE);

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
          <h1 className="h1">{t(onBody || !hasBody ? 'body.title' : 'body.exercises')}</h1>
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
        ) : onBody ? (
          <BodyOverview body={body} errors={typicalErrors(progress.history)} />
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

/** A 0..100 quality as a radar axis label, or the whole profile at a glance. */
const RADAR_KEYS = ['shoulders', 'knees', 'symmetry', 'amplitude', 'core', 'smoothness'] as const;
const SHORT: Record<(typeof RADAR_KEYS)[number], I18nKey> = {
  shoulders: 'body.r.shoulders',
  knees: 'body.r.knees',
  symmetry: 'body.r.symmetry',
  amplitude: 'body.r.amplitude',
  core: 'body.r.core',
  smoothness: 'body.r.smoothness',
};

function BodyOverview({
  body,
  errors,
}: {
  body: BodyStats;
  errors: { id: string; rate: number }[];
}) {
  const tone = (v: number) => (v >= 75 ? 'green' : v >= 50 ? 'gold' : 'orange');
  return (
    <div className="body-grid">
      <section className="card body-radar-card">
        <Radar body={body} />
        <p className="muted body-how">{t('body.how')}</p>
      </section>
      <section className="card body-list">
        <p className="muted body-sub">{t('body.sub')}</p>
        {BODY_KEYS.map((k) => {
          const v = body[k];
          return (
            <div key={k} className="move-metric">
              <div className="move-metric-head">
                <span>{t(`body.${k}` as I18nKey)}</span>
                <b>
                  {v === undefined ? (
                    <span className="muted body-na">{t('body.notYet')}</span>
                  ) : k === 'speed' ? (
                    <>
                      <span className="num">{v}</span> {t('body.perMin')}
                    </>
                  ) : (
                    <span className="num">{v}/100</span>
                  )}
                </b>
              </div>
              {v !== undefined && k !== 'speed' && (
                <ProgressBar value={v / 100} tone={tone(v)} label={t(`body.${k}` as I18nKey)} />
              )}
            </div>
          );
        })}
        <div className="move-errors">
          <b>{t('body.errors')}</b>
          {errors.length === 0 ? (
            <p className="muted">{t('moves.noErrors')}</p>
          ) : (
            <ul>
              {errors.map((e) => (
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
    </div>
  );
}

/** Six qualities on a hexagon: the bigger and rounder the shape, the better the movement. */
function Radar({ body }: { body: BodyStats }) {
  const R = 92;
  const at = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i / RADAR_KEYS.length) * 2 * Math.PI;
    return [r * Math.cos(a), r * Math.sin(a)] as const;
  };
  const ring = (k: number) =>
    RADAR_KEYS.map((_, i) =>
      at(i, R * k)
        .map((v) => v.toFixed(1))
        .join(','),
    ).join(' ');
  const shape = RADAR_KEYS.map((key, i) =>
    at(i, (R * (body[key] ?? 0)) / 100)
      .map((v) => v.toFixed(1))
      .join(','),
  ).join(' ');
  return (
    <svg viewBox="-200 -132 400 272" className="body-radar" role="img" aria-label={t('body.title')}>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={ring(k)} className="radar-ring" />
      ))}
      {RADAR_KEYS.map((_, i) => {
        const [x, y] = at(i, R);
        return <line key={i} x1={0} y1={0} x2={x} y2={y} className="radar-ring" />;
      })}
      <polygon points={shape} className="radar-shape" />
      {RADAR_KEYS.map((key, i) => {
        const [x, y] = at(i, R + 14);
        const v = body[key];
        const anchor = Math.abs(x) < 4 ? 'middle' : x > 0 ? 'start' : 'end';
        return (
          <text
            key={key}
            x={x}
            y={y + (y > 0 ? 12 : y < -40 ? -4 : 4)}
            textAnchor={anchor}
            className="radar-label"
          >
            <tspan>{t(SHORT[key])}</tspan>
            <tspan x={x} dy="15" className="radar-value">
              {v === undefined ? '—' : v}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

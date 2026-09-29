import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUp, Crown, Earth, Play, Sparkles } from 'lucide-react';
import { useApp } from '@/app/store';
import { t, type I18nKey } from '@/i18n';
import { QUICK } from '@/game/program';
import {
  LocalLeaderboard,
  globalLeaderboard,
  myPlace,
  type LeaderboardEntry,
  type Mode,
} from '@/storage/leaderboard';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { Speech } from '../components/Mascot';

const AVATAR_COLORS = ['#58cc02', '#1cb0f6', '#ff9600', '#ce82ff', '#ff4b4b', '#ffc800'];
export const avatarColor = (name: string) =>
  AVATAR_COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 6]!;
const initial = (name: string) => [...name][0]?.toUpperCase() ?? '?';

/** One tab per leaderboard mode, and what "play" means for it. */
const MODES: { mode: Mode; label: I18nKey; play: I18nKey }[] = [
  { mode: 'challenge', label: 'lb.challenge', play: 'lb.playChallenge' },
  { mode: 'workout', label: 'lb.workout', play: 'lb.playWorkout' },
  { mode: 'dance', label: 'lb.dance', play: 'lb.playDance' },
];
const SIZE = 10;

/**
 * Leaderboard: the top three on a podium stage, and beside it where the player stands (place,
 * best score, points to the next place, a "play" button) above places 4–10. Free places are
 * shown as empty slots, so a young board still looks like a board and invites to take a place.
 */
export function Records() {
  const { playerName, go, startProgram } = useApp();
  const [mode, setMode] = useState<Mode>(() => useApp.getState().boardMode);
  const cycle = (d: 1 | -1) =>
    setMode((m) => {
      const i = MODES.findIndex((x) => x.mode === m);
      return MODES[(i + d + MODES.length) % MODES.length]!.mode;
    });
  useGestures({
    crossArms: () => go('menu'),
    swipeLeft: () => cycle(1),
    swipeRight: () => cycle(-1),
  });
  const { rows, world } = useBoard(mode);
  const cfg = MODES.find((m) => m.mode === mode)!;
  const play = () => (mode === 'workout' ? startProgram(QUICK) : go(mode));

  const top = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  const me = rows ? myPlace(rows, playerName) : null;
  return (
    <div className="page">
      <div className="page-inner lb">
        <div className="page-head">
          <DwellButton
            variant="ghost"
            icon={<ArrowLeft size={22} strokeWidth={2.75} />}
            onSelect={() => go('menu')}
          >
            {t('back')}
          </DwellButton>
          <h1 className="h1">
            {t('lb.title')}
            {world && <Earth className="lb-world" size={26} strokeWidth={2.5} aria-label="world" />}
          </h1>
          <div className="tabs">
            {MODES.map((m) => (
              <DwellButton
                key={m.mode}
                variant="ghost"
                active={m.mode === mode}
                onSelect={() => setMode(m.mode)}
              >
                {t(m.label)}
              </DwellButton>
            ))}
          </div>
        </div>

        <div className="lb-body" key={mode}>
          <section className="lb-stage" aria-label={t('lb.top')}>
            <span className="kicker lb-stage-title">
              <Crown size={18} strokeWidth={2.75} /> {t('lb.top')}
            </span>
            {rows !== null && rows.length === 0 && (
              <Speech mood="cheer" size={72} className="lb-empty-speech">
                {t('records.empty')}
              </Speech>
            )}
            <ol className="podium">
              {[1, 0, 2].map((i) => {
                const r = top[i];
                return (
                  <li
                    key={i}
                    className={`podium-col p${i + 1} ${r?.name === playerName ? 'me' : ''}`}
                  >
                    {r ? (
                      <>
                        <span className="podium-ava" style={{ background: avatarColor(r.name) }}>
                          {i === 0 && (
                            <Crown className="podium-crown" size={30} strokeWidth={2.5} />
                          )}
                          {initial(r.name)}
                        </span>
                        <span className="podium-name">{r.name}</span>
                        <span className="podium-score num">{r.score}</span>
                      </>
                    ) : (
                      <>
                        <span className="podium-ava empty">?</span>
                        <span className="podium-name muted">{t('lb.freeShort')}</span>
                        <span className="podium-score">&nbsp;</span>
                      </>
                    )}
                    <span className="podium-block num">{i + 1}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <aside className="lb-side">
            <div className={`card lb-me ${me ? '' : 'out'}`}>
              <span className="lb-me-ava" style={{ background: avatarColor(playerName) }}>
                {initial(playerName)}
              </span>
              <div className="lb-me-text">
                <b>{playerName}</b>
                {me ? (
                  <span>
                    <span className="num lb-me-place">
                      {t('lb.placeN').replace('{n}', String(me.place))}
                    </span>{' '}
                    · {t('lb.best')} <span className="num">{me.score}</span>
                  </span>
                ) : (
                  <span>{t('lb.notYet')}</span>
                )}
                {me && me.gap > 0 && (
                  <span className="lb-me-gap">
                    <ArrowUp size={16} strokeWidth={3} /> {t('lb.gap')}{' '}
                    <span className="num">{me.gap}</span>
                  </span>
                )}
                {me?.place === 1 && (
                  <span className="lb-me-gap gold">
                    <Sparkles size={16} strokeWidth={3} /> {t('lb.leader')}
                  </span>
                )}
              </div>
              <DwellButton
                variant="primary"
                className="lb-play"
                icon={<Play size={22} strokeWidth={2.75} fill="currentColor" />}
                onSelect={play}
              >
                {t(cfg.play)}
              </DwellButton>
            </div>
            <ol className="lb-lines" start={4}>
              {Array.from({ length: SIZE - 3 }, (_, k) => {
                const r = rest[k];
                const place = k + 4;
                return r ? (
                  <li key={`${r.at}-${k}`} className={r.name === playerName ? 'me' : ''}>
                    <span className="lb-place num">{place}</span>
                    <span className="ava" style={{ background: avatarColor(r.name) }}>
                      {initial(r.name)}
                    </span>
                    <span className="grow">{r.name}</span>
                    <b className="num">{r.score}</b>
                  </li>
                ) : (
                  <li key={`free-${k}`} className="free">
                    <span className="lb-place num">{place}</span>
                    <span className="ava empty" />
                    <span className="grow">{t('lb.free')}</span>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** World board when configured (falls back to this device when offline), else this device. */
function useBoard(mode: Mode): { rows: LeaderboardEntry[] | null; world: boolean } {
  const progress = useApp((s) => s.progress);
  const worldBoard = useMemo(() => globalLeaderboard(), []);
  const [state, setState] = useState<{ rows: LeaderboardEntry[] | null; world: boolean }>({
    rows: null,
    world: false,
  });
  useEffect(() => {
    let alive = true;
    const local = new LocalLeaderboard(() => progress);
    const fromDevice = () =>
      local.top(mode, 'all', SIZE).then((rows) => alive && setState({ rows, world: false }));
    if (worldBoard)
      worldBoard
        .top(mode, 'all', SIZE)
        .then((rows) => alive && setState({ rows, world: true }))
        .catch(fromDevice);
    else void fromDevice();
    return () => {
      alive = false;
    };
  }, [mode, progress, worldBoard]);
  return state;
}

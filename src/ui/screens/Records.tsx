import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crown, Earth } from 'lucide-react';
import { useApp } from '@/app/store';
import { t } from '@/i18n';
import {
  LocalLeaderboard,
  globalLeaderboard,
  type LeaderboardEntry,
  type Mode,
} from '@/storage/leaderboard';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';

const AVATAR_COLORS = ['#58cc02', '#1cb0f6', '#ff9600', '#ce82ff', '#ff4b4b', '#ffc800'];
export const avatarColor = (name: string) =>
  AVATAR_COLORS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 6]!;
const initial = (name: string) => [...name][0]?.toUpperCase() ?? '?';

const MODES: Mode[] = ['challenge', 'workout'];
const SIZE = 10;

/** Leaderboard, nothing else: the top three on a podium, everyone else as plain lines. */
export function Records() {
  const { playerName, go } = useApp();
  const [mode, setMode] = useState<Mode>('challenge');
  const other = () => setMode((m) => (m === 'challenge' ? 'workout' : 'challenge'));
  useGestures({ crossArms: () => go('menu'), swipeLeft: other, swipeRight: other });
  const { rows, world } = useBoard(mode);

  const top = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
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
              <DwellButton key={m} variant="ghost" active={m === mode} onSelect={() => setMode(m)}>
                {t(m === 'challenge' ? 'lb.challenge' : 'lb.workout')}
              </DwellButton>
            ))}
          </div>
        </div>

        {rows === null ? (
          <p className="muted lb-empty">…</p>
        ) : rows.length === 0 ? (
          <p className="muted lb-empty">{t('records.empty')}</p>
        ) : (
          <div className="lb-body" key={mode}>
            <ol className="podium" aria-label={t('lb.top')}>
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
                      <span className="podium-ava empty">—</span>
                    )}
                    <span className="podium-block num">{i + 1}</span>
                  </li>
                );
              })}
            </ol>
            {rest.length > 0 && (
              <ol className="lb-lines" start={4}>
                {rest.map((r, i) => (
                  <li key={`${r.at}-${i}`} className={r.name === playerName ? 'me' : ''}>
                    <span className="lb-place num">{i + 4}</span>
                    <span className="ava" style={{ background: avatarColor(r.name) }}>
                      {initial(r.name)}
                    </span>
                    <span className="grow">{r.name}</span>
                    <b className="num">{r.score}</b>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
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

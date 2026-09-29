import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Play, X } from 'lucide-react';
import { useApp } from '@/app/store';
import { t, type I18nKey } from '@/i18n';
import { speak } from '@/audio/tts';
import { QUICK } from '@/game/program';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import type { Mood } from '../mascot/mascot';
import { Mascot } from './Mascot';
import { GestureGuide } from './GestureGuide';
import { HandsUpIcon } from './icons';

interface Step {
  id: string;
  /** `data-tour` value of the menu elements to spotlight; none = the whole screen stays grey */
  target?: string;
  mood: Mood;
}

const STEPS: Step[] = [
  { id: 'hello', mood: 'wave' },
  { id: 'training', target: 'training', mood: 'happy' },
  { id: 'modes', target: 'modes', mood: 'happy' },
  { id: 'challenge', target: 'challenge', mood: 'cheer' },
  { id: 'records', target: 'records', mood: 'happy' },
  { id: 'profile', target: 'profile', mood: 'wave' },
  { id: 'settings', target: 'settings', mood: 'think' },
  { id: 'gestures', mood: 'think' },
  { id: 'final', target: 'training', mood: 'cheer' },
];

const PAD = 10;
const GAP = 22;
const EDGE = 16;

type Rect = { left: number; top: number; width: number; height: number };

/** Union of the bounding boxes of every element tagged `data-tour="<target>"`. */
function measure(target?: string): Rect | null {
  if (!target) return null;
  const els = [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)];
  // on a phone the menu scrolls: bring the spotlighted block on screen first
  els[0]?.scrollIntoView({ block: 'nearest' });
  const rs = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
  if (!rs.length) return null;
  const left = Math.min(...rs.map((r) => r.left)) - PAD;
  const top = Math.min(...rs.map((r) => r.top)) - PAD;
  const right = Math.max(...rs.map((r) => r.right)) + PAD;
  const bottom = Math.max(...rs.map((r) => r.bottom)) + PAD;
  return { left, top, width: right - left, height: bottom - top };
}

const RADIUS = 22;

/** Full-screen rectangle minus a rounded hole (even-odd), for clip-path. */
function holePath({ left: x, top: y, width: w, height: h }: Rect): string {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const r = Math.min(RADIUS, w / 2, h / 2);
  const n = (v: number) => v.toFixed(1);
  return (
    `path(evenodd, 'M0 0H${W}V${H}H0Z` +
    `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${r} ${r} 0 0 1 ${n(x + w)} ${n(y + r)}` +
    `V${n(y + h - r)}A${r} ${r} 0 0 1 ${n(x + w - r)} ${n(y + h)}` +
    `H${n(x + r)}A${r} ${r} 0 0 1 ${n(x)} ${n(y + h - r)}` +
    `V${n(y + r)}A${r} ${r} 0 0 1 ${n(x + r)} ${n(y)}Z')`
  );
}

/** Put the card next to the spotlight: right, left, below, above — whichever fits first. */
function place(spot: Rect | null, cw: number, ch: number): { x: number; y: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const center = { x: (W - cw) / 2, y: (H - ch) / 2 };
  if (!spot) return center;
  const y = clamp(spot.top, EDGE, H - ch - EDGE);
  const x = clamp(spot.left, EDGE, W - cw - EDGE);
  const right = spot.left + spot.width + GAP;
  if (right + cw <= W - EDGE) return { x: right, y };
  const left = spot.left - GAP - cw;
  if (left >= EDGE) return { x: left, y };
  const below = spot.top + spot.height + GAP;
  if (below + ch <= H - EDGE) return { x, y: below };
  const above = spot.top - GAP - ch;
  if (above >= EDGE) return { x, y: above };
  return { x: center.x, y: H - ch - EDGE };
}

/**
 * First-visit tour of the menu: the screen goes grey, Barys introduces himself and walks through
 * each area (training → modes → challenge → leaderboard → profile → settings → gestures), and
 * ends by sending the player to the quick workout first. Driven by dwell buttons, hands up
 * (next) and crossed arms (skip) — or the mouse.
 */
export function Tour() {
  const { closeTutorial, startProgram, playerName } = useApp();
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  const [spot, setSpot] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);

  const next = () => (last ? closeTutorial() : setI((n) => Math.min(n + 1, STEPS.length - 1)));
  const startTraining = () => {
    closeTutorial();
    startProgram(QUICK);
  };
  useGestures({ handsUp: () => (last ? startTraining() : next()), crossArms: closeTutorial });

  // the mascot talks: every step is read aloud
  useEffect(() => {
    speak(
      (tr) => `${tr(`tour.${step.id}.title` as I18nKey)}. ${tr(`tour.${step.id}.text` as I18nKey)}`,
    );
  }, [step.id]);

  useLayoutEffect(() => {
    const update = () => {
      const s = measure(step.target);
      setSpot(s);
      const c = card.current;
      if (c) setPos(place(s, c.offsetWidth, c.offsetHeight));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [step.target, i]);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={t('tour.label')}>
      {/* everything turns grey except a rounded window around the spotlighted area */}
      <div className="tour-dim" style={spot ? { clipPath: holePath(spot) } : undefined} />
      {spot && (
        <div
          className="tour-spot"
          style={{ left: spot.left, top: spot.top, width: spot.width, height: spot.height }}
        />
      )}
      <div
        ref={card}
        key={step.id}
        className={`tour-card ${spot ? '' : 'tour-card-center'} ${
          spot && spot.top + spot.height / 2 > window.innerHeight / 2 ? 'dock-top' : ''
        }`}
        style={pos ? { left: pos.x, top: pos.y } : { visibility: 'hidden' }}
      >
        <div className="tour-head">
          <Mascot mood={step.mood} size={step.id === 'hello' ? 120 : 84} bob />
          <div className="tour-bubble">
            <h2>{t(`tour.${step.id}.title` as I18nKey)}</h2>
            <p>{t(`tour.${step.id}.text` as I18nKey)}</p>
            {step.id === 'hello' && (
              <p className="tour-name">
                {t('tour.nameIs')} <b>{playerName}</b>
              </p>
            )}
          </div>
        </div>
        {step.id === 'gestures' && <GestureGuide compact />}
        <div className="tour-dots" aria-hidden="true">
          {STEPS.map((s, k) => (
            <span key={s.id} className={k === i ? 'now' : k < i ? 'done' : ''} />
          ))}
        </div>
        <div className="tour-actions">
          {last ? (
            <>
              <DwellButton
                variant="primary"
                icon={<Play size={22} strokeWidth={2.75} fill="currentColor" />}
                onSelect={startTraining}
              >
                {t('tour.go')}
              </DwellButton>
              <DwellButton variant="ghost" onSelect={closeTutorial}>
                {t('tour.later')}
              </DwellButton>
            </>
          ) : (
            <>
              <DwellButton
                variant="primary"
                icon={<ArrowRight size={22} strokeWidth={3} />}
                onSelect={next}
              >
                {t('tour.next')}
              </DwellButton>
              <DwellButton
                variant="ghost"
                icon={<X size={20} strokeWidth={3} />}
                onSelect={closeTutorial}
              >
                {t('tour.skip')}
              </DwellButton>
            </>
          )}
        </div>
        <p className="tour-hint">
          <HandsUpIcon size={20} /> {t(last ? 'tour.hintGo' : 'tour.hintNext')}
        </p>
      </div>
    </div>
  );
}

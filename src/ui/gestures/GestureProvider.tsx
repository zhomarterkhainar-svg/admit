import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { HandCursor, type Cursor } from '@/gestures/cursor';
import { DwellTracker, type DwellTarget } from '@/gestures/dwell';

/** fallback when the fist can't be seen (too far for the hand model): hover this long = click */
const FALLBACK_DWELL_MS = 4000;
import { GrabDetector, squeezeProgress } from '@/gestures/grab';
import { PoseGestureDetector, type PoseGesture } from '@/gestures/poseGestures';
import type { PoseSource } from '@/core/vision/poseLoop';
import { sfx } from '@/audio/sfx';

interface Registered {
  el: HTMLElement;
  onSelect: () => void;
  /** a corner button on a camera screen: no cursor until the hand is over it */
  quiet: boolean;
}

interface GestureApi {
  register(id: string, el: HTMLElement, onSelect: () => void, quiet?: boolean): () => void;
  subscribe(fn: (g: PoseGesture) => void): () => void;
}

const Ctx = createContext<GestureApi | null>(null);

export function useGestureApi(): GestureApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('GestureProvider missing');
  return api;
}

/** Subscribe to whole-body gestures; only the gestures present in `handlers` are handled. */
export function useGestures(handlers: Partial<Record<PoseGesture, () => void>>): void {
  const api = useGestureApi();
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => api.subscribe((g) => ref.current[g]?.()), [api]);
}

/**
 * Turns the pose stream into UI input: a hand cursor that clicks DwellButtons when the open palm
 * is squeezed into a fist over them (no hover-to-click), and whole-body gestures (hands up, crossed
 * arms, swipes). The cursor is only shown while at least one DwellButton is on screen.
 */
interface ProviderProps {
  loop: PoseSource;
  children: ReactNode;
  /** false in demo mode: the virtual athlete must not drive the UI (mouse still works) */
  enabled?: boolean;
}

export function GestureProvider({ loop, children, enabled = true }: ProviderProps) {
  const buttons = useRef(new Map<string, Registered>());
  /** bumped whenever a button appears or goes away (the cached rects are stale then) */
  const version = useRef(0);
  const listeners = useRef(new Set<(g: PoseGesture) => void>());
  const cursorEl = useRef<HTMLDivElement>(null);

  const api = useMemo<GestureApi>(
    () => ({
      register(id, el, onSelect, quiet = false) {
        buttons.current.set(id, { el, onSelect, quiet });
        version.current++;
        return () => {
          buttons.current.get(id)?.el.style.removeProperty('--dwell');
          buttons.current.delete(id);
          version.current++;
        };
      },
      subscribe(fn) {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
    }),
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    // main click = squeezing the palm into a fist; a long 4 s hover is the fallback
    const dwell = new DwellTracker(FALLBACK_DWELL_MS);
    const detector = new PoseGestureDetector();
    const hand = new HandCursor();
    const grab = new GrabDetector();
    let cursor: Cursor | null = null;
    // button rects are cached: reading them on every pose tick forced a full layout 30×/s
    let targets: DwellTarget[] = [];
    /** at least one ordinary (not quiet) button is on screen */
    let anyLoud = false;
    let targetsAt = -Infinity;
    let targetsVersion = -1;
    const invalidate = () => (targetsAt = -Infinity);
    window.addEventListener('resize', invalidate);
    window.addEventListener('scroll', invalidate, true);
    // the camera delivers ~15–30 poses/s; the cursor is drawn every display frame (60+ Hz),
    // gliding toward the latest filtered position so it never steps or stutters
    const shown = { x: 0, y: 0, placed: false };
    let lastDraw = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      const c = cursorEl.current;
      const dt = Math.min(now - lastDraw, 100);
      lastDraw = now;
      if (c && cursor) {
        const W = window.innerWidth;
        const H = window.innerHeight;
        if (!shown.placed) {
          shown.x = cursor.x * W;
          shown.y = cursor.y * H;
          shown.placed = true;
        } else {
          const k = 1 - Math.exp(-dt / 55);
          shown.x += (cursor.x * W - shown.x) * k;
          shown.y += (cursor.y * H - shown.y) * k;
        }
        c.style.transform = `translate3d(${shown.x.toFixed(1)}px, ${shown.y.toFixed(1)}px, 0)`;
      } else {
        shown.placed = false;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    let lastHover: string | null = null;
    // the button under the cursor while the hand was still open: closing the hand into a fist
    // moves the pose "fingertip" a little, the click goes to where the hand was pointing
    let hoverOpen: string | null = null;
    // after a selection the next screen often has a button under the same spot:
    // freeze dwell briefly so it can't be selected by accident
    let cooldownUntil = 0;

    const unsubscribe = loop.subscribe((tick) => {
      for (const g of detector.update(tick.frame, tick.features))
        listeners.current.forEach((fn) => fn(g));

      if (tick.t - targetsAt > 300 || targetsVersion !== version.current) {
        targetsAt = tick.t;
        targetsVersion = version.current;
        const W = window.innerWidth;
        const H = window.innerHeight;
        targets = [];
        anyLoud = false;
        for (const [id, { el, quiet }] of buttons.current) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || el.closest('[aria-hidden="true"]')) continue;
          targets.push({
            id,
            rect: { left: r.left / W, top: r.top / H, right: r.right / W, bottom: r.bottom / H },
          });
          if (!quiet) anyLoud = true;
        }
      }

      cursor = hand.update(tick.frame, tick.t);
      if (!targets.length) cursor = null;
      const cooling = tick.t < cooldownUntil;
      const st = dwell.update(cursor, targets, tick.t, cooling);
      // the hand model (fist click) runs only while the hand points at a button: it costs a
      // second network per frame, and during an exercise the arms are up all the time
      loop.trackHand?.(cursor && st.hoverId ? cursor.hand : null);
      const fist = grab.update(cursor ? tick.hand : null, tick.t);
      if (!fist.closed) hoverOpen = st.hoverId;
      const squeeze = cursor && st.hoverId && !cooling ? squeezeProgress(tick.hand?.openness) : 0;

      const c = cursorEl.current;
      if (c) {
        // with only a quiet corner button (a workout's "Exit"), the cursor shows up just when
        // the hand is over it — not whenever the arms go up during an exercise
        c.style.opacity = cursor && (anyLoud || st.hoverId) ? '1' : '0';
        c.style.setProperty('--dwell', String(Math.max(squeeze, st.progress)));
        c.classList.toggle('is-grab', !!cursor && fist.closed);
      }
      if (lastHover && lastHover !== st.hoverId) {
        const prev = buttons.current.get(lastHover)?.el;
        prev?.classList.remove('is-hover');
        prev?.style.setProperty('--dwell', '0');
      }
      if (st.hoverId) {
        const el = buttons.current.get(st.hoverId)?.el;
        el?.classList.add('is-hover');
        el?.style.setProperty('--dwell', String(Math.max(squeeze, st.progress)));
      }
      lastHover = st.hoverId;
      const squeezed = fist.grab && !cooling ? (hoverOpen ?? st.hoverId) : null;
      const selected = squeezed ?? st.selected;
      if (selected) {
        cooldownUntil = tick.t + 900;
        dwell.lock(selected);
        targetsAt = -Infinity; // the screen is about to change
        sfx.select();
        buttons.current.get(selected)?.onSelect();
      }
    });
    return () => {
      unsubscribe();
      loop.trackHand?.(null);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('scroll', invalidate, true);
    };
  }, [loop, enabled]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div ref={cursorEl} className="hand-cursor" aria-hidden="true" />
    </Ctx.Provider>
  );
}

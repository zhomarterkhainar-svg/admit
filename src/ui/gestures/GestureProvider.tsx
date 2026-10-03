import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { HandCursor, type Cursor } from '@/gestures/cursor';
import type { DwellTarget } from '@/gestures/dwell';
import { CursorClicker } from '@/gestures/clicker';
import { fingerPath } from '@/gestures/fingers';
import { palmCenter } from '@/gestures/cursor';
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
  const fingersEl = useRef<SVGPathElement>(null);

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
    const clicker = new CursorClicker();
    const detector = new PoseGestureDetector();
    const hand = new HandCursor();
    let cursor: Cursor | null = null;
    /** the hand the hand model is currently asked to follow */
    let trackedSide: 'l' | 'r' | null = null;
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

      // the hand model's palm (when it sees the tracked hand) steers the cursor by the fingers
      const pts = tick.hand?.points;
      const palm = trackedSide && pts ? palmCenter(pts) : null;
      cursor = hand.update(
        tick.frame,
        tick.t,
        palm && trackedSide ? { hand: trackedSide, ...palm } : null,
      );
      if (!targets.length) cursor = null;
      const st = clicker.update(cursor, targets, tick.hand, tick.t);
      // the hand model follows the fingers whenever the cursor is shown (menus); during an
      // exercise (only a quiet corner button) just while pointing at it — the arms are up all the time
      const visible = !!cursor && (anyLoud || !!st.hoverId);
      trackedSide = visible ? cursor!.hand : null;
      loop.trackHand?.(trackedSide);

      const c = cursorEl.current;
      if (c) {
        // with only a quiet corner button (a workout's "Exit"), the cursor shows up just when
        // the hand is over it — not whenever the arms go up during an exercise
        c.style.opacity = cursor && (anyLoud || st.hoverId) ? '1' : '0';
        c.style.setProperty('--dwell', String(st.progress));
        c.classList.toggle('is-grab', st.closed);
        const d = visible && tick.frame ? fingerPath(pts, tick.frame.width, tick.frame.height) : '';
        if (fingersEl.current) fingersEl.current.setAttribute('d', d);
        c.classList.toggle('has-fingers', d !== '');
      }
      if (lastHover && lastHover !== st.hoverId) {
        const prev = buttons.current.get(lastHover)?.el;
        prev?.classList.remove('is-hover');
        prev?.style.setProperty('--dwell', '0');
      }
      if (st.hoverId) {
        const el = buttons.current.get(st.hoverId)?.el;
        el?.classList.add('is-hover');
        el?.style.setProperty('--dwell', String(st.progress));
      }
      lastHover = st.hoverId;
      const selected = st.selected;
      if (selected) {
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
      <div ref={cursorEl} className="hand-cursor" aria-hidden="true">
        {/* live skeleton of the tracked hand: the fingers curl into a fist as you squeeze */}
        <svg className="hand-fingers" viewBox="0 0 56 56">
          <path ref={fingersEl} />
        </svg>
      </div>
    </Ctx.Provider>
  );
}

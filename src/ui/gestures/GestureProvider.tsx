import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { computeCursor, type Cursor } from '@/gestures/cursor';
import { DwellTracker, type DwellTarget } from '@/gestures/dwell';
import { PoseGestureDetector, type PoseGesture } from '@/gestures/poseGestures';
import type { PoseSource } from '@/core/vision/poseLoop';
import { sfx } from '@/audio/sfx';

interface Registered {
  el: HTMLElement;
  onSelect: () => void;
}

interface GestureApi {
  register(id: string, el: HTMLElement, onSelect: () => void): () => void;
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
 * Turns the pose stream into UI input: a hand cursor that "clicks" DwellButtons by hovering,
 * and whole-body gestures (hands up, crossed arms, swipes). The cursor is only shown while
 * at least one DwellButton is on screen.
 */
interface ProviderProps {
  loop: PoseSource;
  children: ReactNode;
  /** false in demo mode: the virtual athlete must not drive the UI (mouse still works) */
  enabled?: boolean;
}

export function GestureProvider({ loop, children, enabled = true }: ProviderProps) {
  const buttons = useRef(new Map<string, Registered>());
  const listeners = useRef(new Set<(g: PoseGesture) => void>());
  const cursorEl = useRef<HTMLDivElement>(null);

  const api = useMemo<GestureApi>(
    () => ({
      register(id, el, onSelect) {
        buttons.current.set(id, { el, onSelect });
        return () => {
          buttons.current.get(id)?.el.style.removeProperty('--dwell');
          buttons.current.delete(id);
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
    const dwell = new DwellTracker(1100);
    const detector = new PoseGestureDetector();
    let cursor: Cursor | null = null;
    let lastHover: string | null = null;
    // after a selection the next screen often has a button under the same spot:
    // freeze dwell briefly so it can't be selected by accident
    let cooldownUntil = 0;

    return loop.subscribe((tick) => {
      for (const g of detector.update(tick.frame, tick.features))
        listeners.current.forEach((fn) => fn(g));

      const W = window.innerWidth;
      const H = window.innerHeight;
      const targets: DwellTarget[] = [];
      for (const [id, { el }] of buttons.current) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || el.closest('[aria-hidden="true"]')) continue;
        targets.push({
          id,
          rect: { left: r.left / W, top: r.top / H, right: r.right / W, bottom: r.bottom / H },
        });
      }

      cursor = targets.length && tick.frame ? computeCursor(tick.frame, cursor) : null;
      const st = dwell.update(tick.t < cooldownUntil ? null : cursor, targets, tick.t);

      const c = cursorEl.current;
      if (c) {
        c.style.opacity = cursor ? '1' : '0';
        if (cursor) c.style.transform = `translate(${cursor.x * W}px, ${cursor.y * H}px)`;
        c.style.setProperty('--dwell', String(st.progress));
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
      if (st.selected) {
        cooldownUntil = tick.t + 900;
        dwell.reset();
        sfx.select();
        buttons.current.get(st.selected)?.onSelect();
      }
    });
  }, [loop, enabled]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div ref={cursorEl} className="hand-cursor" aria-hidden="true" />
    </Ctx.Provider>
  );
}

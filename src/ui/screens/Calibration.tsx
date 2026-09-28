import { useEffect, useRef, useState } from 'react';
import { t, type I18nKey } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { useApp } from '@/app/store';
import type { FrameFeatures } from '@/core/types';
import { DARK_THRESHOLD } from '@/engine/setupRules';
import { useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { OverlayCanvas } from '../overlay/OverlayCanvas';

type Check = 'light' | 'person' | 'single' | 'fullBody' | 'distance' | 'centered' | 'facing';
const CHECKS: Check[] = ['light', 'person', 'single', 'fullBody', 'distance', 'centered', 'facing'];

function evaluate(
  f: FrameFeatures | null,
  people: number,
  brightness?: number,
): Record<Check, boolean> {
  return {
    light: brightness === undefined || brightness >= DARK_THRESHOLD,
    person: !!f,
    single: people <= 1,
    fullBody: !!f && f.visibility.feet > 0.5 && f.bodyHeightFrac < 1.02,
    distance: !!f && f.bodyHeightFrac > 0.45,
    centered: !!f && f.center.x > 0.25 && f.center.x < 0.75,
    facing: !!f && f.frontality > 0.45,
  };
}

/** Step 1: get the whole body in frame. Step 2: learn the hand cursor by dwelling on "I'm ready". */
export function Calibration() {
  const loop = useLoop();
  const setCalibrated = useApp((s) => s.setCalibrated);
  const [checks, setChecks] = useState<Record<Check, boolean>>(evaluate(null, 0));
  const [step, setStep] = useState<'frame' | 'cursor'>('frame');
  const okSince = useRef<number | null>(null);

  useEffect(() => {
    speak(t('calib.title'));
  }, []);

  useEffect(() => {
    if (step !== 'frame') return;
    let last = 0;
    return loop.subscribe((tick) => {
      const c = evaluate(tick.features, tick.people, tick.brightness);
      const all = CHECKS.every((k) => c[k]);
      okSince.current = all ? (okSince.current ?? tick.t) : null;
      if (okSince.current && tick.t - okSince.current > 1500) {
        sfx.perfect();
        speak(`${t('calib.ok')} ${t('calib.cursorTitle')}`);
        setStep('cursor');
      }
      if (tick.t - last > 150) {
        last = tick.t;
        setChecks(c);
      }
    });
  }, [loop, step]);

  const allOk = CHECKS.every((k) => checks[k]);
  return (
    <>
      <OverlayCanvas loop={loop} />
      {step === 'frame' ? (
        <div className="panel-layer">
          <svg
            className={`silhouette ${allOk ? 'ok' : ''}`}
            viewBox="0 0 100 200"
            aria-hidden="true"
          >
            <path d="M50 8a13 13 0 1 1 0 26a13 13 0 1 1 0-26M30 42h40l14 58l-10 3l-10-40v45l6 82h-12l-8-72l-8 72h-12l6-82v-45l-10 40l-10-3z" />
          </svg>
          <div className="calib-card">
            <h2>{t('calib.title')}</h2>
            <ul className="checklist">
              {CHECKS.map((k) => (
                <li key={k} className={checks[k] ? 'ok' : ''}>
                  <span className="check-dot">{checks[k] ? '✓' : ''}</span>
                  {t(`calib.${k}` as I18nKey)}
                </li>
              ))}
            </ul>
          </div>
          <div className="calib-skip">
            <DwellButton variant="ghost" icon="⏭" sub={t('calib.skipSub')} onSelect={setCalibrated}>
              {t('calib.skip')}
            </DwellButton>
          </div>
        </div>
      ) : (
        <div className="screen-dim center">
          <h1 className="h1">{t('calib.cursorTitle')}</h1>
          <p className="lead">{t('calib.cursorText')}</p>
          <DwellButton variant="primary" onSelect={setCalibrated} icon="✋">
            {t('calib.ready')}
          </DwellButton>
        </div>
      )}
    </>
  );
}

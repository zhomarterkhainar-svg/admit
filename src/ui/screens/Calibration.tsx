import { useEffect, useRef, useState } from 'react';
import { t, type I18nKey } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { useApp } from '@/app/store';
import type { FrameFeatures } from '@/core/types';
import { DARK_THRESHOLD } from '@/engine/setupRules';
import { BaselineEstimator } from '@/engine/baseline';
import { useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { Check, Hand, SkipForward } from 'lucide-react';
import { Mascot, Speech } from '../components/Mascot';
import { ProgressBar } from '../components/ProgressBar';
import { MirrorPip } from '../components/MirrorPip';
import { CursorSetupTip } from '../components/CursorSetupTip';

type Check = 'light' | 'person' | 'fullBody' | 'distance' | 'centered' | 'facing';
const CHECKS: Check[] = ['light', 'person', 'fullBody', 'distance', 'centered', 'facing'];

function evaluate(f: FrameFeatures | null, brightness?: number): Record<Check, boolean> {
  return {
    light: brightness === undefined || brightness >= DARK_THRESHOLD,
    person: !!f,
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
  const setBaseline = useApp((s) => s.setBaseline);
  const [checks, setChecks] = useState<Record<Check, boolean>>(evaluate(null));
  const [step, setStep] = useState<'frame' | 'cursor'>('frame');
  const okSince = useRef<number | null>(null);

  useEffect(() => {
    speak((tr) => tr('calib.title'));
    // whoever stands in front of the camera now is the player; people behind are ignored
    loop.resetLock?.();
  }, [loop]);

  useEffect(() => {
    if (step !== 'frame') return;
    let last = 0;
    const estimator = new BaselineEstimator(30);
    return loop.subscribe((tick) => {
      const c = evaluate(tick.features, tick.brightness);
      const all = CHECKS.every((k) => c[k]);
      // while the user stands correctly, learn how they stand (personal baseline)
      if (all && tick.features) estimator.add(tick.features);
      okSince.current = all ? (okSince.current ?? tick.t) : null;
      if (okSince.current && tick.t - okSince.current > 1500) {
        sfx.perfect();
        if (estimator.value) setBaseline(estimator.value);
        speak((tr) => `${tr('calib.ok')} ${tr('calib.cursorTitle')}`);
        setStep('cursor');
      }
      if (tick.t - last > 150) {
        last = tick.t;
        setChecks(c);
      }
    });
  }, [loop, step, setBaseline]);

  const allOk = CHECKS.every((k) => checks[k]);
  const okCount = CHECKS.filter((k) => checks[k]).length;
  return step === 'frame' ? (
    <>
      <OverlayCanvas loop={loop} />
      <div className="panel-layer">
        <svg className={`silhouette ${allOk ? 'ok' : ''}`} viewBox="0 0 100 200" aria-hidden="true">
          <path d="M50 8a13 13 0 1 1 0 26a13 13 0 1 1 0-26M30 42h40l14 58l-10 3l-10-40v45l6 82h-12l-8-72l-8 72h-12l6-82v-45l-10 40l-10-3z" />
        </svg>
        <div className="calib-card">
          <Speech mood={allOk ? 'cheer' : 'think'} size={64}>
            {t(allOk ? 'calib.ok' : 'calib.title')}
          </Speech>
          <div className="calib-progress">
            <ProgressBar value={okCount / CHECKS.length} />
            <span className="quest-count num">
              {okCount}/{CHECKS.length}
            </span>
          </div>
          <ul className="checklist">
            {CHECKS.map((k) => (
              <li key={k} className={checks[k] ? 'ok' : ''}>
                <span className="check-dot">
                  {checks[k] && <Check size={16} strokeWidth={4} />}
                </span>
                {t(`calib.${k}` as I18nKey)}
              </li>
            ))}
          </ul>
        </div>
        <div className="calib-skip">
          <DwellButton
            variant="ghost"
            icon={<SkipForward size={20} strokeWidth={2.75} />}
            sub={t('calib.skipSub')}
            onSelect={setCalibrated}
          >
            {t('calib.skip')}
          </DwellButton>
        </div>
      </div>
    </>
  ) : (
    <div className="page">
      <div className="page-inner center">
        <div className="cursor-step">
          <div className="cursor-step-help">
            <Mascot mood="wave" size={120} bob />
            <CursorSetupTip className="card" />
          </div>
          <div className="intro-text" style={{ alignItems: 'flex-start', textAlign: 'left' }}>
            <h1 className="h1">{t('calib.cursorTitle')}</h1>
            <p className="lead">{t('calib.cursorText')}</p>
            <MirrorPip />
            <DwellButton
              variant="primary"
              onSelect={setCalibrated}
              icon={<Hand size={28} strokeWidth={2.75} />}
              tone="green"
            >
              {t('calib.ready')}
            </DwellButton>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { PoseSource, PoseTick } from '@/core/vision/poseLoop';
import { OverlayCanvas } from '../overlay/OverlayCanvas';

const r = (n: number) => (Number.isFinite(n) ? Math.round(n) : '—');
const f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');

/** Developer HUD: live skeleton + raw features. Base for tuning thresholds. */
export function LiveDebug({ loop, info }: { loop: PoseSource; info: string }) {
  const [tick, setTick] = useState<PoseTick | null>(null);
  useEffect(() => {
    let last = 0;
    return loop.subscribe((t) => {
      if (t.frame && performance.now() - last < 100) return; // throttle React to 10 Hz
      last = performance.now();
      setTick(t);
    });
  }, [loop]);

  const f = tick?.features;
  return (
    <>
      <OverlayCanvas loop={loop} />
      <div className="hud-debug">
        <div>
          {info} · {tick ? `${r(tick.fps)} fps · ${f2(tick.inferenceMs)} ms` : '…'} · people:{' '}
          {tick?.people ?? 0}
        </div>
        {f && (
          <pre>
            {[
              `knee    L ${r(f.kneeAngle.l)}°  R ${r(f.kneeAngle.r)}°`,
              `hip     L ${r(f.hipAngle.l)}°  R ${r(f.hipAngle.r)}°`,
              `elbow   L ${r(f.elbowAngle.l)}°  R ${r(f.elbowAngle.r)}°`,
              `shoulder L ${r(f.shoulderAngle.l)}° R ${r(f.shoulderAngle.r)}°`,
              `torso lean ${r(f.torsoLean)}°  side ${r(f.torsoSideLean)}°`,
              `stance ${f2(f.stanceRatio)}  knee/ankle ${f2(f.kneeAnkleRatio)}`,
              `wrist lift L ${f2(f.wristLift.l)} R ${f2(f.wristLift.r)}`,
              `body ${f2(f.bodyHeightFrac)}  frontality ${f2(f.frontality)}`,
              `vis up ${f2(f.visibility.upper)} low ${f2(f.visibility.lower)} feet ${f2(f.visibility.feet)}`,
            ].join('\n')}
          </pre>
        )}
      </div>
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PoseSource, PoseTick } from '@/core/vision/poseLoop';
import type { PoseFrame } from '@/core/types';
import { ExerciseRunner, type RunnerState } from '@/engine/runner';
import { EXERCISES, EXERCISE_IDS, type ExerciseId } from '@/exercises/registry';
import { compactFrame, downloadRecording } from '@/dev/recording';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { defaultClassifier } from '@/ml/recognizer';
import { toVector } from '@/ml/vector';

const r = (n: number) => (Number.isFinite(n) ? Math.round(n) : '—');
const f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '—');

/**
 * Developer screen (?dev=1): live skeleton, raw features, a live runner for the chosen
 * exercise (phase, reps, active rules) and a recorder that saves real movements as JSON
 * fixtures for tests/fixtures (see tests/fixtures/README.md).
 */
export function LiveDebug({ loop, info }: { loop: PoseSource; info: string }) {
  const [tick, setTick] = useState<PoseTick | null>(null);
  const [exId, setExId] = useState<ExerciseId>('squat');
  const [label, setLabel] = useState('good');
  const [recording, setRecording] = useState(false);
  const [st, setSt] = useState<RunnerState | null>(null);
  const [recCount, setRecCount] = useState(0);
  const runner = useMemo(() => new ExerciseRunner(EXERCISES[exId]), [exId]);
  const frames = useRef<PoseFrame[]>([]);
  const recRef = useRef(false);
  useEffect(() => {
    recRef.current = recording;
  });

  useEffect(() => {
    let last = 0;
    return loop.subscribe((t) => {
      const s = runner.update(t.features, t.people, t.t, { brightness: t.brightness });
      if (recRef.current && t.frame) frames.current.push(compactFrame(t.frame));
      if (s.events.length || t.t - last > 100) {
        last = t.t;
        setTick(t);
        setSt(s);
        if (recRef.current) setRecCount(frames.current.length);
      }
    });
  }, [loop, runner]);

  const toggleRec = () => {
    if (recording) {
      downloadRecording({
        version: 1,
        exercise: exId,
        label,
        recordedAt: new Date().toISOString(),
        frames: frames.current,
      });
      frames.current = [];
    }
    setRecording(!recording);
  };

  const f = tick?.features;
  const knn = f
    ? (({ label, confidence }) => `${label} ${f2(confidence)}`)(
        defaultClassifier().predict(toVector(f)),
      )
    : '—';
  return (
    <>
      <OverlayCanvas loop={loop} errorJoints={st?.errorJoints} />
      <div className="hud-debug">
        <div>
          {info} · {tick ? `${r(tick.fps)} fps · ${f2(tick.inferenceMs)} ms` : '…'} · people:{' '}
          {tick?.people ?? 0}
        </div>
        <div className="dev-row">
          <select value={exId} onChange={(e) => setExId(e.target.value as ExerciseId)}>
            {EXERCISE_IDS.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="good-5 | bad-squat.depth"
          />
          <button onClick={toggleRec} className={recording ? 'rec on' : 'rec'}>
            {recording ? `stop (${recCount})` : 'rec'}
          </button>
        </div>
        {st && (
          <pre>
            {[
              `phase ${st.phase}  progress ${f2(st.progress)}  counted ${st.counted}/${st.attempted}  paused ${st.paused}`,
              `hint  ${st.hint?.id ?? '—'}`,
              `kNN   ${knn}`,
              `reps  ${runner.reps
                .slice(-4)
                .map(
                  (x) =>
                    `${x.counted ? '+' : '-'}${x.quality}${x.errors.length ? `[${x.errors.join(',')}]` : ''}`,
                )
                .join('  ')}`,
            ].join('\n')}
          </pre>
        )}
        {f && (
          <pre>
            {[
              `knee    L ${r(f.kneeAngle.l)}°  R ${r(f.kneeAngle.r)}°   drop L ${f2(f.kneeDrop.l)} R ${f2(f.kneeDrop.r)}`,
              `hip     L ${r(f.hipAngle.l)}°  R ${r(f.hipAngle.r)}°   inward L ${f2(f.kneeInward.l)} R ${f2(f.kneeInward.r)}`,
              `elbow   L ${r(f.elbowAngle.l)}°  R ${r(f.elbowAngle.r)}°`,
              `shoulder L ${r(f.shoulderAngle.l)}° R ${r(f.shoulderAngle.r)}°`,
              `torso lean ${r(f.torsoLean)}°  pitch ${r(f.torsoPitch)}°  side ${r(f.torsoSideLean)}°`,
              `stance ${f2(f.stanceRatio)}  knee/ankle ${f2(f.kneeAnkleRatio)}  ankleZ ${f2(f.ankleZDiff)}`,
              `wrist lift L ${f2(f.wristLift.l)} R ${f2(f.wristLift.r)}  overhead ${f.wristAboveHead.l}/${f.wristAboveHead.r}`,
              `body ${f2(f.bodyHeightFrac)}  frontality ${f2(f.frontality)}  center ${f2(f.center.x)}`,
              `vis up ${f2(f.visibility.upper)} low ${f2(f.visibility.lower)} feet ${f2(f.visibility.feet)}`,
            ].join('\n')}
          </pre>
        )}
      </div>
    </>
  );
}

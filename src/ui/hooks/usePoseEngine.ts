import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraError, startCamera, stopCamera } from '@/core/camera/camera';
import { PoseLoop } from '@/core/vision/poseLoop';
import { createPoseTracker, type PoseModel, type PoseTracker } from '@/core/vision/poseTracker';

export type EngineStatus =
  | { state: 'idle' }
  | { state: 'loading'; step: 'camera' | 'model' }
  | { state: 'ready'; loop: PoseLoop; tracker: PoseTracker }
  | { state: 'error'; kind: CameraError['kind'] | 'model'; message: string };

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** `?model=lite|full` forces a model (for comparing speed / accuracy on a device) */
const forcedModel = (): PoseModel | null => {
  const m = new URLSearchParams(location.search).get('model');
  return m === 'lite' || m === 'full' ? m : null;
};

/** Slow device? After a warm-up, if inference stays under 14 FPS, hot-swap to the lite model. */
function watchPerformance(loop: PoseLoop, onSwap: (lite: PoseTracker) => void): void {
  const startedAt = performance.now();
  let slowSince: number | null = null;
  let switching = false;
  const unsub = loop.subscribe((tick) => {
    if (switching || tick.t - startedAt < 4000) return;
    slowSince = tick.fps < 14 ? (slowSince ?? tick.t) : null;
    if (slowSince !== null && tick.t - slowSince > 3000) {
      switching = true;
      unsub();
      void createPoseTracker('lite').then((lite) => {
        const old = loop.currentTracker;
        loop.setTracker(lite);
        onSwap(lite);
        old.close();
        console.info('[pose] switched to lite model for performance');
      });
    }
  });
}

/** Owns camera + MediaPipe lifecycle. `start()` must be called from a user gesture on iOS. */
export function usePoseEngine(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<EngineStatus>({ state: 'idle' });
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<PoseLoop | null>(null);
  const trackerRef = useRef<PoseTracker | null>(null);

  const start = useCallback(
    async (model: PoseModel = forcedModel() ?? (isMobile() ? 'lite' : 'full')) => {
      const video = videoRef.current;
      if (!video) return;
      try {
        setStatus({ state: 'loading', step: 'camera' });
        // load model in parallel with camera permission prompt
        const trackerP = createPoseTracker(model);
        streamRef.current = await startCamera(video);
        setStatus({ state: 'loading', step: 'model' });
        const tracker = await trackerP;
        const loop = new PoseLoop(video, tracker);
        trackerRef.current = tracker;
        loopRef.current = loop;
        loop.start();
        setStatus({ state: 'ready', loop, tracker });
        if (tracker.model === 'full' && !forcedModel())
          watchPerformance(loop, (lite) => (trackerRef.current = lite));
      } catch (err) {
        if (err instanceof CameraError)
          setStatus({ state: 'error', kind: err.kind, message: err.message });
        else setStatus({ state: 'error', kind: 'model', message: String(err) });
      }
    },
    [videoRef],
  );

  useEffect(
    () => () => {
      loopRef.current?.stop();
      trackerRef.current?.close();
      stopCamera(streamRef.current);
    },
    [],
  );

  return { status, start };
}

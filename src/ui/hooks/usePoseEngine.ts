import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraError, startCamera, stopCamera } from '@/core/camera/camera';
import { PoseLoop } from '@/core/vision/poseLoop';
import { PoseTracker, type PoseModel } from '@/core/vision/poseTracker';

export type EngineStatus =
  | { state: 'idle' }
  | { state: 'loading'; step: 'camera' | 'model' }
  | { state: 'ready'; loop: PoseLoop; tracker: PoseTracker }
  | { state: 'error'; kind: CameraError['kind'] | 'model'; message: string };

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/** Owns camera + MediaPipe lifecycle. `start()` must be called from a user gesture on iOS. */
export function usePoseEngine(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<EngineStatus>({ state: 'idle' });
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<PoseLoop | null>(null);
  const trackerRef = useRef<PoseTracker | null>(null);

  const start = useCallback(
    async (model: PoseModel = isMobile() ? 'lite' : 'full') => {
      const video = videoRef.current;
      if (!video) return;
      try {
        setStatus({ state: 'loading', step: 'camera' });
        // load model in parallel with camera permission prompt
        const trackerP = PoseTracker.create(model);
        streamRef.current = await startCamera(video);
        setStatus({ state: 'loading', step: 'model' });
        const tracker = await trackerP;
        const loop = new PoseLoop(video, tracker);
        trackerRef.current = tracker;
        loopRef.current = loop;
        loop.start();
        setStatus({ state: 'ready', loop, tracker });
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

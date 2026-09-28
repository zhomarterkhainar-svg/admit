import { createContext, useContext } from 'react';
import type { PoseLoop } from '@/core/vision/poseLoop';

export const EngineContext = createContext<PoseLoop | null>(null);

export function useLoop(): PoseLoop {
  const loop = useContext(EngineContext);
  if (!loop) throw new Error('useLoop() outside of EngineContext');
  return loop;
}

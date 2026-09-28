import { createContext, useContext } from 'react';
import type { PoseSource } from '@/core/vision/poseLoop';

import type { DemoActor } from '@/demo/DemoActor';

/** Set only in demo mode: lets screens tell the virtual athlete what to perform. */
export const DemoContext = createContext<DemoActor | null>(null);

export const useDemo = () => useContext(DemoContext);

export const EngineContext = createContext<PoseSource | null>(null);

export function useLoop(): PoseSource {
  const loop = useContext(EngineContext);
  if (!loop) throw new Error('useLoop() outside of EngineContext');
  return loop;
}

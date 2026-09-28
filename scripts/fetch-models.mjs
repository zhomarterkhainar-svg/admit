// Self-hosts MediaPipe wasm + models in public/ so the deployed app never depends on a third-party CDN.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://storage.googleapis.com/mediapipe-models';
const MODELS = {
  'pose_landmarker_lite.task': `${BASE}/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`,
  'pose_landmarker_full.task': `${BASE}/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task`,
  'hand_landmarker.task': `${BASE}/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`,
};

const wasmSrc = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDst = join(root, 'public/wasm');
if (existsSync(wasmSrc)) {
  cpSync(wasmSrc, wasmDst, { recursive: true });
  console.log('[models] wasm copied → public/wasm');
} else {
  console.warn('[models] @mediapipe/tasks-vision not installed yet, skipping wasm copy');
}

const modelsDir = join(root, 'public/models');
mkdirSync(modelsDir, { recursive: true });
for (const [name, url] of Object.entries(MODELS)) {
  const dst = join(modelsDir, name);
  if (existsSync(dst)) continue;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
    console.log(`[models] downloaded ${name}`);
  } catch (err) {
    console.warn(
      `[models] failed to download ${name}: ${err.message}. The app will fall back to the CDN.`,
    );
  }
}

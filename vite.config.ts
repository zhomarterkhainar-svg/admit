import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// BASE_PATH is set by CI for GitHub Pages (/admithack/); locally it is "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // the MediaPipe worker is an ES module (it loads the ES build of the wasm loader)
  worker: { format: 'es' },
  // PORT: set by preview tools when 5173 is taken
  server: { host: true, port: Number(process.env.PORT) || undefined },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tests/**/*.test.ts'] },
});

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));
// Repo root holds data/cards.json, which we import from the app.
const repoRoot = resolve(here, '..', '..');

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow serving files from the monorepo root (data/cards.json + the
    // workspace-linked @mood-swings/engine TypeScript source).
    fs: { allow: [repoRoot] },
  },
  // The engine is a workspace package that ships raw .ts via its exports map;
  // let Vite transpile it on the fly rather than pre-bundling it.
  optimizeDeps: { exclude: ['@mood-swings/engine'] },
});

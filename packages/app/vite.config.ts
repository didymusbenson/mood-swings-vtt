import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = dirname(fileURLToPath(import.meta.url));
// Repo root holds data/cards.json, which we import from the app.
const repoRoot = resolve(here, '..', '..');

// GitHub Pages serves this project under https://<user>.github.io/mood-swings-vtt/,
// so production assets must be requested from that sub-path. Dev/preview stay at
// the root ('/') so `vite dev` keeps working. Override with VITE_BASE if the repo
// (and therefore the Pages sub-path) is ever renamed or served from a custom domain.
const PAGES_BASE = process.env.VITE_BASE ?? '/mood-swings-vtt/';

export default defineConfig(({ command }) => ({
  // Only the production build needs the project-pages sub-path; `vite dev` and
  // `vite preview` run from '/'.
  base: command === 'build' ? PAGES_BASE : '/',
  plugins: [react()],
  server: {
    // Allow serving files from the monorepo root (data/cards.json + the
    // workspace-linked @mood-swings/engine TypeScript source).
    fs: { allow: [repoRoot] },
  },
  // The engine is a workspace package that ships raw .ts via its exports map;
  // let Vite transpile it on the fly rather than pre-bundling it.
  optimizeDeps: { exclude: ['@mood-swings/engine'] },
}));

# Mood Swings — project instructions

## Workflow: always merge to main and deploy after work completes

When a piece of work is finished (committed on its feature branch), **always
merge it back to `main` and deploy** — do not leave completed work sitting on a
branch. The standard sequence:

1. Commit and push the work on the feature branch.
2. `git checkout main && git pull origin main`
3. `git merge --no-ff <feature-branch>` and `git push origin main`.
4. The push to `main` triggers the GitHub Pages deploy automatically (see below).
5. Confirm the deploy run succeeds.

## Deploy mechanics

- The site deploys via `.github/workflows/deploy-pages.yml` (GitHub Pages).
- It runs on every push to `main` (and to `claude/v2-deployment-strategy-iorlce`),
  plus manual `workflow_dispatch`.
- The GitHub App / MCP token here lacks `actions:write`, so it **cannot**
  `workflow_dispatch`. Trigger a deploy by pushing to `main` instead.
- Live site: https://didymusbenson.github.io/mood-swings-vtt/
- After a deploy, hard-refresh (Cmd/Ctrl+Shift+R) to bust cached CSS/JS.

## Build & run

- Monorepo (npm workspaces): `@mood-swings/engine` (rules) + `@mood-swings/app` (React/Vite UI).
- Install: `npm install` at the repo root (installs all workspaces, incl. `peerjs`).
- Dev server: `npm run dev` (Vite, in `packages/app`).
- Typecheck: `npm run typecheck`. Build: `npm run build`. Engine tests: `npm test`.

## Card art

- Card fronts/backs are hotlinked from a CDN (never committed). Art may be
  blocked in sandboxed dev containers — components fall back to a CSS/SVG frame
  (or a monogram chip for the discard indicator) when an image fails to load.

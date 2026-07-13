# Card data tooling

Moodfall (`moodswings.scryfall.com`) is server-rendered, so each card page
contains the full card data in its HTML. These scripts turn that into JSON.
No dependencies; Node 18+.

## Scripts

- **`parse-card.mjs`** — pure parser: one card page's HTML → structured record
  (`value`, `dieColor`, `secondaryValue`, `rulesText`, `rarity`, `artist`,
  `image`, `color`). `color` is derived from collector number. Tested against
  `samples/glee.html`.
- **`build-index.mjs`** — search-page HTML → `data/card-index.json` (all 135
  cards: number, slug, name, color, url). Already run.
- **`scrape-cards.mjs`** — fetches every card page in the index and writes
  `data/cards.json`.

## Generating `data/cards.json`

`scrape-cards.mjs` needs network access to `scryfall.com`. Run it anywhere that
policy allows (your machine, or a session whose environment network policy
permits scryfall — the default restricted policy blocks it):

```bash
node tools/scrape-cards.mjs
```

It prints a per-card line and flags anything missing a value/rarity for review.

## Quick parser check

```bash
node -e "import('./tools/parse-card.mjs').then(async m=>{const fs=await import('node:fs');console.log(m.parseCardHtml(fs.readFileSync('tools/samples/glee.html','utf8')))})"
```

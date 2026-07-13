# Mood Swings — Virtual Tabletop: Requirements & Plan

> Status: **Planning.** Rules are now fully documented (see
> [`docs/RULES.md`](docs/RULES.md)). Card *metadata* (names/numbers/colors/slugs)
> is captured for all 135 cards; card *text/values* still need a data pull (see
> [§4](#4-card-data-status) and the open questions).

## 1. Goal

A virtual tabletop to play **Mood Swings** (Mark Rosewater / Secret Lair, 2026).

- **v1 (MVP):** mechanically complete **hotseat** — two players share one
  frontend, take turns, each has a hand. All hand knowledge is **public** for now.
- **v2:** real multiplayer — two clients connect; opponent's hand shown as **card
  backs** (hidden info), server-authoritative state.

Two ways to get a starting deck:
1. **Deckbuilder** — pick cards (must satisfy custom-deck minimums).
2. **Random deck** — generate a deck matching the **Secret Lair box collation**.

## 2. Rules — see [`docs/RULES.md`](docs/RULES.md) and [`docs/card-notes.md`](docs/card-notes.md)

`docs/card-notes.md` holds Mark Rosewater's per-card mechanical clarifications
(all 130 cards) — the source of truth for effect edge cases (e.g. simultaneous
target selection, suppressed = value 0, Duplicity double-resolution).


Full extracted ruleset lives there. The mechanically load-bearing facts for the engine:

- **Shared deck + shared discard.** Each player draws **5** to start. Moods (cards
  in play) **persist across rounds** until an effect moves them.
- **Round:** each player takes **exactly one turn** (play one card **or** pass), in
  order. After all have acted → **scoring**. First to **win 3 rounds** wins.
- **Scoring:** sum values of your moods; highest wins; **tie → earlier player**.
- **Value** = die in top-right. **White die = fixed**, **black die = variable**
  (recompute at scoring). Optional **secondary value** (lower-left), possibly two
  dice added; values range **0–12**.
- **Effect timing pipeline** (per play): pay `To play this card` cost → enter play
  → apply `While in play` to a **fixpoint** → resolve `After playing this mood` →
  re-apply `While in play` to a fixpoint. Then **after-scoring** effects in turn
  order (Sneakiness can flip the winner).
- **Ownership**, **suppression** (value→0, identity preserved), **copy**, and
  count-based queries (`moodiest`, `most common color`, `total value [n]`) are
  first-class engine concepts.
- **2-player simplifications:** no **Hurt Feelings**, single loser draws one card.

## 3. Deck Construction

- **Pool:** 133-card set (48 common / 40 uncommon / 30 rare / 15 mythic).
  Scryfall lists 135 entries: the 133 + **#134** foil *Love* (headliner) + **#135**
  *Hurt Feelings* (special multiplayer card).
- **Random deck (box collation):** **45 cards = 23 C / 14 U / 6 R / 2 M**, no
  duplicates, drawn from the pool. → the "Random deck" button reproduces this.
- **Custom deck minimum (2 players):** **15 cards.** (+15 per extra player.)
  Duplicates allowed but off by default. Deckbuilder enforces the 15-card minimum
  and the rarity-aware random generator.

## 4. Card Data Status — ✅ complete

**Committed:** [`data/cards.json`](data/cards.json) — all **135** cards with
`value, dieColor, secondaryValue, rulesText, rarity, artist, image, color`, plus
[`data/card-index.json`](data/card-index.json). Validated: 48C/40U/30R/15M (the
133-card set) + #134 foil Love + #135 Hurt Feelings; 102 fixed / 33 variable
dice; 35 secondary values; exactly 5 no-text vanillas (one per colour). Produced
by the user running `tools/scrape-cards.mjs` (scryfall is network-blocked in this
session).

## 5. Proposed Architecture

- **`packages/engine` (framework-agnostic TypeScript):** pure reducer
  `reduce(state, action) → state`, data-driven cards, the value-fixpoint
  recompute, round/game loop. Reused verbatim by v1 (local) and v2 (server).
- **`packages/app` (React + TypeScript + Vite):** board with zones (each player's
  **moods**, shared **deck**/**discard**, per-player **hand**, round/score
  tracker), plus **deckbuilder** and **random-deck** screens. v1 runs the engine
  in-browser with a hotseat "current player" toggle; both hands visible.
- **v2:** Node + WebSocket server owns the authoritative engine; clients send
  actions and receive **redacted** views (opponent hand → backs/counts). Same
  engine module shared client/server. Rooms + reconnect.
- **Data:** `data/cards.json` (generated) → typed card DB imported by the engine.
  Card faces: bundled `.webp` **or** rendered text faces (Q3).

## 6. Tooling (built)

- [`tools/parse-card.mjs`](tools/parse-card.mjs) — pure parser for a Moodfall SSR
  card page → structured record. **Tested** against `tools/samples/glee.html`
  (extracts value, die color, secondary value, rules text, rarity, artist, image).
- [`tools/build-index.mjs`](tools/build-index.mjs) — builds `data/card-index.json`
  from the search page. Already run.
- [`tools/scrape-cards.mjs`](tools/scrape-cards.mjs) — fetches all 135 pages and
  writes `data/cards.json`. **Ready to run** in a network-open environment.

---

## 7. Build status

- ✅ Monorepo scaffold (`packages/engine`, npm workspaces).
- ✅ Engine core: zones, turn/round/scoring/after-scoring/win loop, while-in-play
  value fixpoint, per-card effect-hook interface, deck construction. **16 tests
  pass, typecheck clean.** Reference cards encoded: #92 Glee, #134 Love.
- ✅ Card data + rules + notes committed.
- ⏳ Encode remaining ~128 effects (systematic, data-driven — see `docs/card-notes.md`).
- ⏳ React + Vite hotseat app (board, deckbuilder, random-deck).

## Decisions (locked)

- **Card data:** user runs the scraper locally → `data/cards.json` ✅ done.
- **Automation:** **full** — engine enforces every card's effects.
- **Art:** text faces first; later **Scryfall CDN → cache → local storage**.
- **Stack:** React + TypeScript + Vite + shared TS engine.

*(All earlier open questions resolved: rules loop, moods persisting, hand size,
win condition, deck counts, custom-deck minimums, value dice, tiebreakers, and
the four decisions above.)*

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

## 2. Rules — see [`docs/RULES.md`](docs/RULES.md)

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

## 4. Card Data Status

**Have (committed):** [`data/card-index.json`](data/card-index.json) — all 135
cards: `number, slug, name, color, url`. Color is derived deterministically from
collector number (numbering runs white→blue→black→red→green, alphabetical within
color; verified against the index). Counts: W26 / U26 / B27 / R27 / G28 / 1 special.

**Missing:** per-card **value, die color, secondary value, rules text, rarity,
artist** — i.e. `data/cards.json`. The data is fully available on each Moodfall
SSR card page and the parser is **built and tested** (see §6), but this session's
**network policy blocks `scryfall.com`**, so I can't run the fetch here. See Q1.

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

## <a name="open-questions"></a>Open Questions

1. **Card data source (BLOCKING).** How do you want `data/cards.json` produced?
   (a) You **loosen this session's network policy** (allow `moodswings.scryfall.com`)
   and I run `tools/scrape-cards.mjs` here; (b) you **run it locally** and commit
   the output; or (c) you paste me the raw data another way. Everything downstream
   needs the values + rules text.
2. **Automation depth (biggest scope driver).** Should the engine **fully enforce**
   all ~130 unique card effects (requirements, while-in-play, after-playing,
   after-scoring), or is v1 a **"digital tabletop"** — engine tracks zones/turns/
   scoring and *fixed* white-die values, but players resolve complex card text by
   manually moving cards / setting values? Recommendation: **hybrid** — automate
   turn/round/scoring + the common structured effects, with manual overrides for
   the long tail — so we can play *now* and deepen automation card-by-card.
3. **Card images.** OK to bundle the Scryfall `.webp` art (also network-blocked
   here — you'd provide them), or should MVP render **text-only** card faces?
4. **Tech stack.** React + TypeScript + Vite for the app + a shared TS engine — good?

*(Resolved by the rules PDF: turn/round loop, moods persisting, setup/hand size,
win condition, deck counts, custom-deck minimums, value dice, tiebreakers.)*

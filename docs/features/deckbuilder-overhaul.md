# Feature: Deckbuilder Overhaul

> **Status:** Refined — ready for implementation. Product forks resolved via chat
> (search depth, copy policy, persistence, display mode); rulings recorded below.
> Not yet built. Lives in the **Deckbuilder** tab of `StartScreen`
> (`packages/app/src/components/StartScreen.tsx`); engine helpers in
> `packages/engine/src/deck.ts`.

## Summary

The current deckbuilder is just a list of card names and colors, which is
useless to a player who doesn't already know the cards. Overhaul it so that all
card information is easily searchable and digestible, and the deck list is easy
to view and modify.

## Brief (captured)

### Card information & preview

- **Hover preview:** previewing a card on hover.
- **Per-card detail:** surface more general detail per card (beyond just
  name + color).

### Search & filtering

- Limited **search functionality** to make finding and filtering cards more
  straightforward.

### Card browser / viewer

- A **paginated viewer** with display-mode options:
  - text-only list,
  - visual spoiler (card images),
  - or some mix of the two.

### Deck list panel

- A dedicated space that tracks the **current list of included moods** and how
  many copies of each the player has.
- From the deck-list preview, players can **add or subtract copies** of a card.
  Subtracting the last copy removes the card from the deck entirely.

### Deck persistence & sharing

- **Save decks to local storage** — persist built decks in the browser so they
  survive between sessions.
- **Import decks from a text list** — build/load a deck by pasting a plain-text
  card list.

## Spec (refined)

### Layout — three regions

The Deckbuilder tab becomes a **three-region** workspace (replacing today's flat
color-grouped grid of `compact` cards):

1. **Toolbar (top):** search box + filter chips + display-mode toggle +
   deck-management actions (save / load / import / export). See below.
2. **Card browser (main, left/center):** the paginated pool viewer. Clicking a
   card's **[+]** adds a copy to the deck; hovering/tapping opens the Preview.
3. **Deck-list panel (right rail):** the live list of included moods with copy
   counts and **[−] / [+]** steppers, a running total, rarity/color breakdown,
   and the validity readout. This is the same panel whether you built the deck by
   hand, imported it, or loaded a saved one.

The existing **Preview** treatment is reused: the builder feeds the same
`PreviewPane` / `Card large` surface the game board uses, so a previewed card
looks identical to in-game. (Builder previews are **read-only → printed values**,
never computed — consistent with Value Transparency's "a card merely being read
shows its printed value" rule; there is no board state to compute against.)

### Card browser — display modes

**Default: enriched text list.** A paginated list; each row shows **name ·
color swatch · printed value (pip-die) · rarity · a one-line rules-text
snippet**, plus a **[+] add** control and a copies badge if the card is already
in the deck. Text-first because it is fast, offline-safe, and readable without
knowing the cards — art is CDN-hotlinked (`useCardImage`) and may not load.

**Toggle: visual spoiler.** A grid of full card faces (`Card` with art), same
[+]/copies affordances overlaid. Falls back to the CSS/SVG frame face when art
can't load (existing `FallbackFace` behaviour).

- A segmented **View: (•) List / ( ) Spoiler** control in the toolbar switches
  modes; the choice persists (localStorage, see Persistence).
- **Pagination:** page the pool (e.g. 24/page in spoiler, more in list) with
  prev/next + page indicator; keep it responsive with no horizontal page scroll.
  Search/filter narrows the paged set. Sort order: by **collector number**
  (color then alphabetical — the box order), matching today's `POOL` sort.
- **Hover/tap → Preview** works identically in both modes (mouse hover >1s or an
  instant tap/click, mirroring Value Transparency's Preview triggers).

### Search & filtering (full-text + filter chips)

- **Search box:** case-insensitive substring match over **card name AND rules
  text**. So a player who wants "cards that care about the discard pile" can type
  `discard` and find them without knowing names. Empty search = whole pool.
- **Filter chips** (combinable; AND across categories, OR within a category):
  - **Color:** white / blue / black / red / green (use the existing color
    tokens; colorless never appears in the playable pool).
  - **Rarity:** common / uncommon / rare / mythic.
  - **Die color:** fixed (white die) / variable (black die).
  - **Value range:** a 0–12 min/max control (printed primary value).
  - **Has secondary value** (optional toggle) and **Has rules text** (excludes
    the five vanillas) are cheap adds if the chip row has room.
- Search + chips + pagination compose. A visible **result count** ("37 of 133")
  and a **Clear filters** affordance keep state legible.

### Per-card detail (Preview contents)

The Preview surfaces everything in `CardData` — no new data pull required:

- **name**, **color** (frame + spelled-out color text for accessibility),
- **printed value** (primary pip-die, fixed/variable) and **secondary value**
  (lower-left die) when present,
- **rarity**, **artist**,
- **full rules text** (with reminder text shown as printed),
- **collector number**, **set**.

> **MR clarifications are out of scope for v1 data.** `docs/card-notes.md`
> (Mark Rosewater's per-card mechanical clarifications) was consumed at
> engine-encoding time only — it is **not** loaded at runtime, so the app has no
> structured clarification field. Surfacing MR clarifications in the Preview would
> require pulling `card-notes.md` into `data/cards.json` (a `notes`/`clarification`
> field). Noted as a **future enhancement**, not part of this overhaul.

### Deck-list panel — copies & editing

- Tracks the **current moods and copy counts**. Internal model is a **count map**
  (`Map<number, count>`), rendered as a compact list sorted by collector number
  (or grouped by color — pick one; collector order matches the browser).
- Each entry has **[−] / [+]** steppers. **[+]** adds a copy; **[−]** subtracts;
  **subtracting the last copy removes the card entirely.** The browser's **[+]**
  is the same add path.
- Header shows the **running total**, the **min/target** ("16 / 15 min"), and a
  small **rarity + color breakdown**.
- Flatten to the engine's `number[]` (repeats = copies) only when starting the
  game or exporting; `StartConfig.deck` stays `number[]` (no engine API change).

### Deckbuilding constraints & validity feedback

Driven by the rules (`docs/RULES.md` "The deck", `REQUIREMENTS.md` §3) and the
existing `deck.ts` helpers:

- **Minimum size:** 15 cards for 2 players (`minDeckSize(2)`), +15 per extra
  player. This is a **hard error** — Start stays disabled below it (today's
  behaviour via `validateCustomDeck().ok`).
- **Live pass/fail:** the panel shows a live readout — green "valid" once the
  minimum is met, otherwise the specific error ("Deck has 12 cards; minimum is
  15…"). **You cannot start a game with an invalid deck** (Start button disabled),
  matching current `canStart`.
- **Copies policy — unlimited, soft-warn non-standard.** Duplicates are
  **rules-legal** (the box ships none, but you may add them), so there is **no
  hard per-card cap**. Duplicates default **off** (a fresh add is one copy). When
  a deck departs from the singleton norm, show a **non-blocking warning**
  ("2 copies of Sadness — box decks ship singletons"), not an error. It does not
  disable Start.
  - Format-specific hard caps (e.g. **Power Duel**: 1 of each card, 1 mythic
    total) are **not** enforced here — they belong to the **Pre-Game
    Configuration** feature, which will pass per-format constraints into the
    builder later. This overhaul only wires the generic 15-card minimum + the
    soft duplicate warning, and leaves a seam for format constraints to plug in.

To support warnings without breaking the `ok`-gates-Start contract, extend
`DeckValidation` with a **`warnings: string[]`** field (separate from `errors`);
`ok` remains `errors.length === 0`.

### Persistence — saved decks (localStorage)

- **Named decks in browser localStorage**, surviving between sessions. A small
  **deck manager** in the toolbar: a dropdown/list of saved decks with
  **New / Rename / Duplicate / Delete**, and **Save** / **Save as…** for the
  current build.
- **Storage shape** (versioned key, e.g. `moodswings.decks.v1`):
  ```
  {
    "<id>": { "name": "Aggro Reds", "cards": { "80": 2, "92": 1, ... },
              "updatedAt": <epoch ms> }
  }
  ```
  Store the **count map keyed by collector number** (stable across data updates),
  not flattened arrays. The active-tab display-mode preference persists under a
  separate small key (e.g. `moodswings.builder.view`).
- Loading a saved deck populates the deck-list panel; editing + Save writes back.
  Unknown/removed card numbers on load are dropped with a surfaced notice.

### Import / export — plain-text list

**Export** the current deck (and let players share it) as a plain-text
decklist; **import** parses the same format back into the deck-list panel.

**Format (MTG-style decklist):**

```
# Aggro Reds — 16 cards
3 Sadness
2 Rage
1 Superiority
Envy
```

- One card per line: an **optional integer count** (bare `3` or `3x`), then the
  **card name** (case-insensitive, trimmed). Missing count = **1**.
- **Blank lines** and lines beginning with **`#`** are ignored (comments /
  title). Export writes a `# <name> — <n> cards` header comment.
- Names resolve by **case-insensitive exact match** against the pool. Import is
  **lenient + reported**: matched lines load; **unmatched or ambiguous lines are
  listed back to the player** ("2 lines couldn't be matched: 'Sadnes', 'Foo'")
  rather than silently dropped. Counts sum if a name repeats across lines.
- Import validates like any deck (minimum, soft duplicate warnings) once loaded;
  it does **not** auto-start.
- (Collector-number references are deferred — `#` is taken by comments, and names
  are how players think. A future `no:134` token could be added if wanted.)

### Relationship to Random deck & Pre-Game Configuration

- **Random deck stays a sibling tab** (unchanged): it generates the 45-card box
  collation (`randomBoxDeck`) with the seed/reroll UI. The overhaul is scoped to
  the **Deckbuilder** tab. A convenience **"Send to builder"** on the Random tab
  (load the rolled deck into the editable deck-list panel to tweak) is a natural,
  optional add.
- **Pre-Game Configuration** (`docs/features/pregame-configuration.md`) will
  layer **format selection** on top (deck minimums, Power Duel singleton/mythic
  caps, draft formats). The builder is designed with a **constraints seam** so a
  chosen format can supply `{ minSize, maxCopies, maxMythic, ... }` that the
  validity readout enforces. Out of scope for this overhaul; the seam is the only
  forward-looking requirement.

## Data model & engine touchpoints

Mostly an **app-side** feature; the engine changes are additive and small.

| Concern | Location | Change |
|---------|----------|--------|
| Builder deck model | `packages/app/src/components/StartScreen.tsx` (+ likely a new `Deckbuilder.tsx` / `game/deckModel.ts`) | Replace `picked: number[]` (a set) with a **count map** + flatten-to-`number[]` on start/export. |
| Validation + warnings | `packages/engine/src/deck.ts` | Add `warnings: string[]` to `DeckValidation`; add a helper flagging non-singleton copies (and a place for future format constraints). `ok` stays `errors`-only. |
| Search/filter/paging | new app module (e.g. `game/browse.ts`) | Pure functions over `db.all()`: text match (name+rules), chip predicates, sort, paginate. Unit-testable. |
| Persistence | new app module (e.g. `game/deckStorage.ts`) | localStorage read/write of the versioned deck store + view preference; tolerant of unknown card numbers. |
| Import/export | new app module (e.g. `game/deckText.ts`) | Pure parse/serialize of the text format; returns `{ deck, unmatched }`. Unit-testable. |
| Preview reuse | `PreviewPane` / `Card` | Reused as-is (read-only, printed values). No computed-value path in the builder. |

No change to `StartConfig` (`deck: number[]`) or the engine's game loop.

## Open questions / to refine

**Resolved (this refinement):**

- **Search depth — RULED: full-text + filter chips.** Search matches **name and
  rules text**; chips for color, rarity, die color, and value range (with
  optional has-secondary / has-rules toggles). This directly serves the "useless
  to a player who doesn't know the cards" problem.
- **Copies — RULED: unlimited, soft-warn.** No hard per-card cap (duplicates are
  rules-legal); duplicates default off; a **non-blocking** warning flags
  departures from the singleton norm. Format caps deferred to Pre-Game Config.
- **Validity — RULED: hard minimum, live feedback, no invalid start.** The
  15-card (2p) minimum is a hard error gating Start; warnings never block.
- **Persistence — RULED: localStorage named decks + text import/export.** Both
  brief items in v1. Storage = versioned count-map keyed by collector number;
  import/export = MTG-style decklist with lenient, **reported** name matching.
- **Display — RULED: enriched text list default + visual-spoiler toggle.**
  Paginated; text-first for speed/offline safety; hover/tap opens the shared
  Preview in both modes.
- **Per-card detail — RULED: everything in `CardData`.** name, color (+text),
  primary/secondary value & die color, rarity, artist, full rules text, number,
  set. **MR clarifications deferred** (not in runtime data — would need a
  `card-notes.md` pull into `cards.json`).
- **Random deck relationship — RULED: sibling tab, unchanged.** Optional
  "Send to builder" bridge; no shared editing surface required.
- **Pre-Game Config relationship — RULED: constraints seam only.** Format-driven
  minimums/caps are handled by that feature; the builder exposes a seam and
  enforces only the generic minimum + soft duplicate warning here.

### Things still worth a human call (non-blocking)

- **Deck-list grouping:** collector order (matches the browser) vs. grouped by
  color. Spec assumes collector order; flag if color grouping is preferred.
- **"Send to builder" bridge from the Random tab:** include in this pass or
  defer? (Small, optional.)
- **Import number-refs:** add a `no:<n>` token now, or leave names-only? (Deferred
  by default.)
</content>
</invoke>

# Feature: Deckbuilder Overhaul

> **Status:** Refined — ready for implementation. Product forks resolved via chat
> (view modes, search/sort depth, copy policy, persistence, detail modal, notes
> data pull); rulings recorded below. Not yet built. **Desktop-first** — mobile is
> a separate, deferred feature (`docs/features/mobile-responsive.md`). Lives in the
> **Deckbuilder** tab of `StartScreen` (`packages/app/src/components/StartScreen.tsx`);
> engine helpers in `packages/engine/src/deck.ts`.

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

1. **Toolbar (top):** search box · filter chips · sort control · **view-mode
   switcher** · deck-management actions (save / load / import / export).
2. **Card browser (main, left/center):** the paginated pool viewer, in one of the
   four **view modes** below, grouped into labeled sections by the active sort.
3. **Deck-list panel (right rail):** the live list of included moods with copy
   counts and steppers, a running total, rarity/color breakdown, and the validity
   readout. Same panel whether the deck was built by hand, imported, or loaded.

### Card browser — four view modes

A **view-mode switcher** in the toolbar chooses among four modes; **Detailed list
is the default**. The choice persists (localStorage).

1. **Simple named list** — color-coded card names only. Fastest/lightest.
2. **Detailed list (default)** — a **table** with columns of card data:
   **Name** (color-coded) · **Color** · **Value** (pip-die, fixed/variable) ·
   **Secondary value** · **Rarity** · **Rules snippet** · the add control. Dense,
   scannable, offline-safe; best for a player who doesn't know the cards.
3. **Visual list** — a grid/list of full card faces (`Card` with art), falling
   back to the CSS/SVG frame face when art can't load (`FallbackFace`).
4. **Visual + detail list** — a row per card: the **card face on the left**, the
   **complete details on the right** (all printed fields **plus Rosewater notes** —
   see *Per-card detail & notes*). The richest inline view; same content the
   detail modal shows.

**Pagination** applies in every mode (brief asked for a paginated viewer); the
heavier visual modes may page in smaller batches. The pool is small (133 cards),
so paging is primarily to bound DOM cost in the visual modes.

### Add control & quantity stepper (every view)

Every view row/tile carries a **clear, obvious add control**:

- **Not in the deck →** a prominent **[+ Add]** button. One click adds a single
  copy.
- **In the deck →** the button becomes an inline **stepper: `− [X] +`**, where
  **`[X]` is a directly-editable quantity box** (type a number to set the count).
  - **`+`** adds a copy; **`−`** subtracts one; **subtracting the last copy (or
    typing `0`) removes the card entirely.**
  - Typing a number sets the exact count; blank/invalid input reverts to the last
    valid value. No hard upper cap (see *Copies policy*), but a large value trips
    the soft non-standard warning.
- The **deck-list panel** uses the identical stepper, so a card's count can be
  edited from either side and stays in sync (single source of truth = the deck
  count map).

### Card detail modal (click the card body)

Clicking the **card body** — anywhere **except** the add control / stepper — opens
a **full-detail modal** (Moxfield-style; the referenced example):

- **Contents:** the card face (image or fallback frame) **plus** the complete
  details — name, color (+ spelled-out color text), primary & secondary value and
  die color, rarity, artist, collector number, set, full rules text, **and the
  Rosewater notes**. This is the same detail payload as the Visual + detail row.
- **Add/quantity controls** live in the modal too (same **[+ Add]** / `− [X] +`
  stepper), so a player can adjust copies without leaving the modal.
- **Prev / Next / Close** navigation across the **current filtered + sorted list**
  (matches the referenced example), so a player can page through candidates
  without reopening.
- **Touch:** no hover on touch — **tapping the card body opens this modal** (tap =
  click). Tapping the stepper adjusts quantity, as on desktop.

### Hover — quick visual preview (desktop, text views only)

Distinct from the click-modal:

- On **mouse hover (>1s)**, a lightweight **visual preview of the card *face*** (the
  image, or the fallback frame) pops near the pointer/row.
- This is **face-only, never full detail** — full detail is exclusively the
  click-modal.
- It only appears in views that **don't already show the card image** — i.e.
  **Simple named list** and **Detailed list**. In **Visual list** and **Visual +
  detail list** the face is already on screen, so hover adds nothing and is
  suppressed.

### Sorting & grouping

- **Sort by:** **value**, **rarity**, **name**, **color** (with an **asc/desc**
  toggle). Default = **color then collector number** (today's box order).
- **Grouped sections with counts**, following the **active sort key**:
  - by **color** → five color sections (white/blue/black/red/green);
  - by **rarity** → common / uncommon / rare / mythic;
  - by **value** → 0…12;
  - by **name** → alphabetical, grouped by first letter.
- Each section header shows its **label + count** (e.g. "Red (27)"). Group headers
  render inline within the paged sequence.

### Search & filtering (full-text + filter chips)

- **Search box:** case-insensitive substring over **card name AND rules text** (so
  typing `discard` surfaces the discard-matters cards without knowing names).
  Empty = whole pool.
- **Filter chips** (combinable; AND across categories, OR within a category):
  - **Color:** white / blue / black / red / green (colorless never appears in the
    playable pool).
  - **Rarity:** common / uncommon / rare / mythic.
  - **Die color:** fixed (white die) / variable (black die).
  - **Value range:** a 0–12 min/max control (printed primary value).
  - Optional cheap adds if the row has room: **Has secondary value**, **Has rules
    text** (excludes the five vanillas).
- Search + chips + sort/grouping + pagination compose. A visible **result count**
  ("37 of 133") and a **Clear filters** affordance keep state legible.

### Per-card detail & Rosewater notes (data pull)

The detail surfaces (Visual + detail row and the modal) show everything in
`CardData` — name, color (+ color text), primary/secondary value & die color,
rarity, artist, full rules text, collector number, set — **plus Rosewater notes**.

**Rosewater notes are pulled into the data as part of this feature.**
`docs/card-notes.md` is cleanly structured (`## <Name> — _<Color> <Rarity>_`, a
`>` rules line, then clarification bullets; ~131 entries) and was previously used
only at engine-encoding time. To surface it at runtime:

- A small build tool (e.g. `tools/merge-notes.mjs`) parses `docs/card-notes.md`,
  resolves each `## Name` to a collector number via the card DB, and emits
  **`data/card-notes.json`** = `{ "<number>": ["note", "note", …] }`.
  Unmatched headings are **reported at build time**, not silently dropped.
- `CardData` gains an **optional `notes?: string[]`**; `loadCardDB` (or `db.ts`)
  **joins** `card-notes.json` onto each card. Keeping notes in a separate file
  leaves the scraper output (`data/cards.json`) pristine and independently
  regenerable. Cards with no clarifications simply have no `notes`.

### Deck-list panel — copies & editing

- Tracks the **current moods and copy counts**. Internal model is a **count map**
  (`Map<number, count>`), rendered as a list grouped/sorted to match the browser.
- Each entry uses the same **`− [X] +`** stepper as the browser rows.
- Header shows the **running total**, the **min/target** ("16 / 15 min"), and a
  small **rarity + color breakdown**.
- Includes a **Clear deck** action (with confirm).
- Flatten to the engine's `number[]` (repeats = copies) only when starting the
  game or exporting; `StartConfig.deck` stays `number[]` (no engine API change).

### Deckbuilding constraints & validity feedback

Driven by the rules (`docs/RULES.md` "The deck", `REQUIREMENTS.md` §3) and the
existing `deck.ts` helpers:

- **Minimum size:** 15 cards for 2 players (`minDeckSize(2)`), +15 per extra
  player. **Hard error** — Start stays disabled below it (today's behaviour via
  `validateCustomDeck().ok`).
- **Live pass/fail:** green "valid" once the minimum is met, else the specific
  error ("Deck has 12 cards; minimum is 15…"). **You cannot start a game with an
  invalid deck** (Start disabled), matching current `canStart`.
- **Copies policy — unlimited, soft-warn non-standard.** Duplicates are
  rules-legal (the box ships none, but you may add them), so **no hard per-card
  cap**. Duplicates default off (a fresh add is one copy). Any card at **>1 copy**
  raises a **non-blocking** warning ("2 copies of Sadness — box decks ship
  singletons"); it does not disable Start.
  - Format-specific hard caps (e.g. **Power Duel**: 1 of each card, 1 mythic
    total) are **not** enforced here — they belong to **Pre-Game Configuration**,
    which will pass per-format constraints into the builder later. This overhaul
    wires only the generic 15-card minimum + the soft duplicate warning, and
    leaves a **constraints seam** for formats to plug in.

To support warnings without breaking the `ok`-gates-Start contract, extend
`DeckValidation` with a **`warnings: string[]`** field (separate from `errors`);
`ok` remains `errors.length === 0`.

### Persistence — saved decks (localStorage) & cross-tab state

- **Named decks in browser localStorage**, surviving between sessions. A small
  **deck manager** in the toolbar: a list of saved decks with **New / Rename /
  Duplicate / Delete**, plus **Save** / **Save as…** for the current build.
- **In-progress builds are ephemeral unless saved.** If the player builds a
  custom deck and **switches tabs / states without saving, the build is reset** —
  saving is the explicit way to keep progress. (No hidden autosave of an unnamed
  draft.)
- **Storage shape** (versioned key, e.g. `moodswings.decks.v1`):
  ```
  {
    "<id>": { "name": "Aggro Reds", "cards": { "80": 2, "92": 1, ... },
              "updatedAt": <epoch ms> }
  }
  ```
  Store the **count map keyed by collector number** (stable across data updates),
  not flattened arrays. The view-mode preference persists under a separate small
  key (e.g. `moodswings.builder.view`).
- Loading a saved deck populates the deck-list panel; editing + Save writes back.
  Unknown/removed card numbers on load are dropped with a surfaced notice.

### Import / export — plain-text list

**Export** the current deck as a plain-text decklist (to share); **import** parses
the same format back into the deck-list panel.

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
- **Blank lines** and lines beginning with **`#`** are ignored (comments / title).
  Export writes a `# <name> — <n> cards` header comment.
- Names resolve by **case-insensitive exact match** against the pool. Import is
  **lenient + reported**: matched lines load; **unmatched/ambiguous lines are
  listed back to the player** rather than silently dropped. Counts sum if a name
  repeats.
- Import validates like any deck (minimum, soft duplicate warnings) once loaded;
  it does **not** auto-start.
- (Collector-number references deferred — `#` is taken by comments, and names are
  how players think. A future `no:134` token could be added if wanted.)

### Relationship to Random deck & Pre-Game Configuration

- **Random deck stays a sibling tab** (unchanged): generates the 45-card box
  collation (`randomBoxDeck`) with the seed/reroll UI. The overhaul is scoped to
  the **Deckbuilder** tab. A convenience **"Send to builder"** on the Random tab
  (load the rolled deck into the editable panel to tweak) is a natural optional
  add — *still open, see below.*
- **Pre-Game Configuration** (`docs/features/pregame-configuration.md`) will layer
  **format selection** on top (deck minimums, Power Duel caps, draft formats). The
  builder is designed with a **constraints seam** so a chosen format can supply
  `{ minSize, maxCopies, maxMythic, … }` that the validity readout enforces. Out
  of scope here; the seam is the only forward-looking requirement.

### Desktop-first; mobile deferred

This spec targets **desktop** (wide, pointer-driven). Touch behaviour is handled
minimally where it's free (tap = click → modal), but a proper responsive/mobile
pass — including the narrow-screen layout of the three regions and the four view
modes — is a **separate deferred feature**: see
`docs/features/mobile-responsive.md`. Do not stretch this work to cover mobile.

## Data model & engine touchpoints

Mostly an **app-side** feature; engine/data changes are additive and small.

| Concern | Location | Change |
|---------|----------|--------|
| Rosewater notes data | `tools/merge-notes.mjs` (new), `data/card-notes.json` (new), `packages/engine/src/types.ts`, `game/db.ts` | Parse `card-notes.md` → `card-notes.json` keyed by number; add optional `notes?: string[]` to `CardData`; join at load. |
| Builder deck model | `StartScreen.tsx` (+ likely new `Deckbuilder.tsx` / `game/deckModel.ts`) | Replace `picked: number[]` (a set) with a **count map**; flatten-to-`number[]` on start/export; ephemeral unless saved. |
| Validation + warnings | `packages/engine/src/deck.ts` | Add `warnings: string[]` to `DeckValidation`; flag non-singleton copies; leave a seam for future format constraints. `ok` stays `errors`-only. |
| Search / filter / sort / group / paginate | new app module (e.g. `game/browse.ts`) | Pure functions over `db.all()`: name+rules match, chip predicates, sort keys, grouping, pagination. Unit-testable. |
| View modes + add/stepper + modal + hover preview | new components (e.g. `Deckbuilder.tsx`, `CardDetailModal.tsx`) | Four view renderers; shared add-control/stepper; click→modal (Prev/Next/Close); hover face-preview in text views only. |
| Persistence | new app module (e.g. `game/deckStorage.ts`) | localStorage deck store + view preference; tolerant of unknown card numbers. |
| Import/export | new app module (e.g. `game/deckText.ts`) | Pure parse/serialize of the text format; returns `{ deck, unmatched }`. Unit-testable. |

No change to `StartConfig` (`deck: number[]`) or the engine's game loop.

## Open questions / to refine

**Resolved (this refinement):**

- **View modes — RULED: four modes.** Simple named list · **Detailed list
  (default)** · Visual list · Visual + detail list.
- **Search/sort — RULED: full-text search + chips; sort by value/rarity/name/
  color (asc/desc); grouped sections with counts by the active sort key.**
- **Add / edit — RULED: obvious [+ Add] per row, becoming a `− [X] +` stepper with
  a directly-editable quantity box; 0 / last-subtract removes.**
- **Detail surface — RULED: click card body → full-detail modal (Moxfield-style,
  Prev/Next/Close, add controls). Hover → face-only visual preview, in the two
  text views only; hover never shows full detail.**
- **Rosewater notes — RULED: pulled into the data as part of this feature** (build
  tool → `data/card-notes.json`; optional `CardData.notes`; joined at load).
- **Copies — RULED: unlimited, soft-warn** on any >1-copy card; no hard cap;
  format caps deferred to Pre-Game Config.
- **Validity — RULED: hard 15-card (2p) minimum gates Start; warnings never block;
  no invalid start.**
- **Persistence — RULED: localStorage named decks + text import/export.** Builds
  are **ephemeral unless saved** (switching tabs/states without saving resets).
- **Random deck — RULED: sibling tab, unchanged.**
- **Pre-Game Config — RULED: constraints seam only** (format caps handled there).
- **Mobile — RULED: out of scope**, deferred to `docs/features/mobile-responsive.md`.

### Still worth a human call (non-blocking)

- **"Send to builder" bridge** from the Random tab — include in this pass or defer?
  (Small, optional.)
- **Import number-refs** — add a `no:<n>` token now, or leave names-only?
  (Deferred by default.)
- **Modal Prev/Next scope** — page through the *filtered+sorted* list (assumed) vs.
  the whole pool. (Assumed filtered+sorted; flag if the whole pool is wanted.)
</content>

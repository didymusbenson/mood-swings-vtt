# Feature: Deckbuilder Overhaul

> **Status:** Refined — fully locked, implementation underway. All product forks
> resolved via chat; rulings recorded below. **Desktop-first** — mobile is a
> separate deferred feature (`docs/features/mobile-responsive.md`). Lives in the
> **Deckbuilder** tab of `StartScreen`
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

1. **Toolbar (top):** a low-key **standard-deck reminder** line (see below) ·
   search box · filter chips · sort control · **view-mode switcher** ·
   deck-management actions (save / load / import / export).
2. **Card browser (main, left/center):** the paginated pool viewer, in one of the
   four **view modes**, grouped into labeled sections by the active sort.
3. **Deck-list panel (right rail):** the live list of included moods with copy
   counts and steppers, a running total, rarity/color breakdown, and the validity
   readout. Same panel whether the deck was built by hand, imported, or loaded.

### Card browser — four view modes

A **view-mode switcher** chooses among four modes; **Detailed list is the
default**. The choice persists (localStorage).

1. **Simple named list** — color-coded card names only. Fastest/lightest.
2. **Detailed list (default)** — a **table** with columns of card data:
   **Name** (color-coded) · **Color** · **Value** (pip-die, fixed/variable) ·
   **Secondary value** · **Rarity** · **Rules snippet** · the add control. Dense,
   scannable, offline-safe; best for a player who doesn't know the cards.
3. **Visual list** — a grid/list of full card faces (`Card` with art), falling
   back to the CSS/SVG frame face when art can't load (`FallbackFace`).
4. **Visual + detail list** — a row per card: the **card face on the left**, the
   **complete details on the right** — all printed fields **plus the full
   Rosewater notes**. This is a genuinely *detailed* view: **rows may be tall**,
   and that's fine. Use **responsive column layout** so the notes column takes the
   room it needs (e.g. notes reflow/expand rather than being clipped). Same detail
   payload as the modal.

**Pagination** applies in every mode (brief asked for a paginated viewer); heavier
visual modes may page in smaller batches. The pool is small (133 cards), so paging
mainly bounds DOM cost in the visual modes.

### Add control & quantity stepper (every view)

Every view row/tile carries a **clear, obvious add control**:

- **Not in the deck →** a prominent **[+ Add]** button. One click adds a copy.
- **In the deck →** the button becomes an inline **stepper: `− [X] +`**, where
  **`[X]` is a directly-editable quantity box** (type a number to set the count).
  - **`+`** adds a copy; **`−`** subtracts one; **subtracting the last copy (or
    typing `0`) removes the card entirely.**
  - Typing a number sets the exact count; blank/invalid input reverts to the last
    valid value. No hard cap (duplicates are rules-legal).
- The **deck-list panel** uses the identical stepper; a card's count can be edited
  from either side and stays in sync (single source of truth = the deck count map).

### Card detail modal (click the card body)

Clicking the **card body** — anywhere **except** the add control / stepper — opens
a **full-detail modal** (Moxfield-style):

- **Single card only.** The modal shows **only the clicked card** — **no
  Prev/Next list navigation.** Dismiss via **X, click-outside, or Esc.**
- **Contents:** the card face (image or fallback frame) **plus** the complete
  details — name, color (+ spelled-out color text), primary & secondary value and
  die color, rarity, artist, collector number, set, full rules text, **and the
  full Rosewater notes**. Same detail payload as the Visual + detail row.
- **Add/quantity controls** live in the modal too (same **[+ Add]** / `− [X] +`
  stepper), so a player can adjust copies without leaving it.
- Values are **printed** (not computed) — the builder has no board state.

### Hover — quick visual preview (desktop, text views only)

Distinct from the click-modal:

- On **mouse hover (>1s)**, a lightweight **visual preview of the card *face*** (the
  image, or fallback frame) pops near the pointer/row.
- **Face-only, never full detail** — full detail is exclusively the click-modal.
- Only in views that **don't already show the card image** — **Simple named list**
  and **Detailed list**. In **Visual list** / **Visual + detail** the face is
  already on screen, so hover is suppressed.
- **Touch:** no hover; **tapping the card body opens the modal** (tap = click).

### Sorting & grouping

- **Sort by:** **value**, **rarity**, **name**, **color** (with an **asc/desc**
  toggle). Default = **color then collector number** (box order).
- **Grouped sections with counts**, following the **active sort key**:
  - by **color** → five color sections;
  - by **rarity** → common / uncommon / rare / mythic;
  - by **value** → 0…12;
  - by **name** → alphabetical, grouped by first letter.
- Each section header shows its **label + count** (e.g. "Red (27)"). Group headers
  render inline within the paged sequence.

### Search & filtering (full-text + filter chips)

- **Search box:** case-insensitive substring over **card name AND rules text**
  (typing `discard` surfaces the discard-matters cards without knowing names).
  Empty = whole pool.
- **Filter chips** (combinable; AND across categories, OR within a category):
  color (white/blue/black/red/green) · rarity (common/uncommon/rare/mythic) · die
  color (fixed/variable) · a 0–12 **value range** · optional **Has secondary** /
  **Has rules text**.
- Search + chips + sort/grouping + pagination compose. A visible **result count**
  ("37 of 133") and a **Clear filters** affordance keep state legible.

### Per-card detail & Rosewater notes (data pull)

The detail surfaces (Visual + detail row and the modal) show everything in
`CardData` plus **the full Rosewater notes**.

**Rosewater notes are pulled into the data as part of this feature.**
`docs/card-notes.md` is cleanly structured (`## <Name> — _<Color> <Rarity>_`, a
`>` rules line, then clarification bullets; ~130 entries). To surface it at runtime:

- A build tool (`tools/merge-notes.mjs`) parses `docs/card-notes.md`, resolves each
  `## Name` to a collector number **within the playable pool** (so the two `Love`
  entries — #92 pool mythic vs #134 filtered headliner — are unambiguous), and
  emits **`data/card-notes.json`** = `{ "<number>": ["note", …] }`. Headings that
  don't resolve are **reported**, not silently dropped.
- `CardData` gains an **optional `notes?: string[]`**; `game/db.ts` **joins**
  `card-notes.json` onto each card after `loadCardDB`. Keeping notes in a separate
  file leaves `data/cards.json` (the scraper output) pristine. Cards with no
  clarifications simply have no `notes` (≈3 pool cards).

### Deck-list panel — copies & editing

- Tracks the **current moods and copy counts**. Internal model is a **count map**
  (`Map<number, count>`), rendered grouped/sorted to match the browser.
- Each entry uses the same **`− [X] +`** stepper as the browser rows.
- Header shows the **running total**, the **min/target** ("16 / 15 min"), and a
  small **rarity + color breakdown**.
- Includes a **Clear deck** action (with confirm).
- Flatten to the engine's `number[]` (repeats = copies) only when starting the
  game or exporting; `StartConfig.deck` stays `number[]` (no engine API change).

### Constraints, validity & the standard-deck reminder

Driven by the rules (`docs/RULES.md` "The deck", `REQUIREMENTS.md` §3) and the
`deck.ts` helpers:

- **Minimum size (hard error):** 15 cards for 2 players (`minDeckSize(2)`), +15 per
  extra player. Start stays disabled below it (today's `validateCustomDeck().ok`),
  with the specific error shown. **You cannot start a game with an invalid deck.**
- **Standard-deck reminder (informational, NOT a warning).** The **only**
  best-practices signal, and it is deliberately **calm** — a small note at the
  **top of the builder**, not an alarm. It reminds the player of the standard
  deckbuilding recommendation: **45 cards — 23 common / 14 uncommon / 6 rare /
  2 mythic** (the retail box mix). It appears whenever the current deck **isn't the
  standard build** — i.e. **not exactly 45 cards**, or **45+ cards whose rarity
  distribution is off** the recommended mix. It never blocks starting and never
  implies the player did something wrong; duplicates are **not** flagged (nothing
  in the extended rules calls them non-standard).
  - Helper: `standardDeckNotice(deck, db): string | null` in `deck.ts`.
  - Format-specific hard caps (e.g. **Power Duel**: 1 of each, 1 mythic) belong to
    **Pre-Game Configuration**, which will pass constraints into the builder later.
    This overhaul wires only the generic minimum + the reminder, leaving a
    **constraints seam** for formats.
- `DeckValidation` gains a **`warnings: string[]`** field (kept separate from
  `errors`; `ok` stays `errors.length === 0`) for future format constraints.

### Persistence — saved decks (localStorage) & the unsaved-changes guard

- **Named decks in browser localStorage**, surviving between sessions. A **deck
  manager** in the toolbar: saved decks with **New / Rename / Duplicate / Delete**,
  plus **Save** / **Save as…**.
- **In-progress builds are ephemeral unless saved**, but **not silently discarded.**
  When the current deck has **unsaved edits** and the player tries to **navigate
  away** in a way that would lose them (switch to the Random tab, load another
  saved deck, New deck), prompt: **"You have unsaved changes to this deck — save
  them before leaving?"** with **Save / Discard** CTAs. **Starting a game** does
  **not** prompt (it just uses the deck). "Dirty" = edits relative to the loaded/
  generated baseline.
- **Storage shape** (versioned key, e.g. `moodswings.decks.v1`):
  ```
  { "<id>": { "name": "Aggro Reds", "cards": { "80": 2, "92": 1 },
              "updatedAt": <epoch ms> } }
  ```
  Count map **keyed by collector number**. View-mode preference persists under a
  separate key (e.g. `moodswings.builder.view`). Unknown card numbers on load are
  dropped with a surfaced notice.

### Import / export — plain-text list

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
- Names resolve by **case-insensitive exact match** (**name only** — no
  collector-number refs). Import is **lenient + reported**: matched lines load;
  **unmatched/ambiguous lines are listed back** rather than silently dropped.
  Counts sum if a name repeats.
- **Delivery:** **import** = paste into a textarea (with an optional "Open file…");
  **export** = **Copy to clipboard** (primary) plus **Download `.txt`** (secondary);
  export writes a `# <name> — <n> cards` header comment.
- Import validates like any deck (minimum, standard-deck reminder) once loaded; it
  does **not** auto-start.

### Relationship to Random deck & Pre-Game Configuration

- **Random deck stays a sibling tab** (unchanged generation via `randomBoxDeck`
  with the seed/reroll UI). It gains a **"View in deckbuilder"** action that
  **prepopulates** the builder from the rolled seed deck. The Random tab **retains
  its seed**, so an **unmodified** deck round-trips back losslessly (populating
  from the seed is the clean baseline — not "unsaved changes"). Once edited,
  navigating back triggers the unsaved-changes guard above.
- **Pre-Game Configuration** (`docs/features/pregame-configuration.md`) will layer
  **format selection** (deck minimums, Power Duel caps, draft formats). The builder
  exposes a **constraints seam** — `{ minSize, maxCopies, maxMythic, … }` — for a
  chosen format to enforce. Out of scope here; the seam is the only forward-looking
  requirement.

### Desktop-first; mobile deferred

This spec targets **desktop** (wide, pointer-driven). Touch is handled minimally
where free (tap = click → modal); a proper responsive/mobile pass is a **separate
deferred feature**: `docs/features/mobile-responsive.md`. Do not stretch this work
to cover mobile.

## Data model & engine touchpoints

Mostly **app-side**; engine/data changes are additive and small.

| Concern | Location | Change |
|---------|----------|--------|
| Rosewater notes data | `tools/merge-notes.mjs` (new), `data/card-notes.json` (new), `packages/engine/src/types.ts`, `packages/app/src/game/db.ts` | Parse `card-notes.md` → `card-notes.json` keyed by number; add optional `notes?: string[]` to `CardData`; join at load. |
| Validation + reminder | `packages/engine/src/deck.ts` | Add `warnings: string[]` to `DeckValidation`; add `standardDeckNotice(deck, db)`; keep `ok` = `errors`-only; seam for future format constraints. |
| Builder deck model | `packages/app/src/game/deckModel.ts` (new) | Count map + add/remove/set/total/flatten/breakdown helpers; ephemeral unless saved. |
| Search / filter / sort / group / paginate | `packages/app/src/game/browse.ts` (new) | Pure functions over `db.all()`. Unit-tested. |
| Persistence | `packages/app/src/game/deckStorage.ts` (new) | localStorage deck store + view preference; tolerant of unknown numbers. Unit-tested. |
| Import/export | `packages/app/src/game/deckText.ts` (new) | Pure parse/serialize; returns `{ counts, unmatched }`. Unit-tested. |
| UI | `packages/app/src/components/deckbuilder/*` (new: `Deckbuilder`, `CardDetailModal`, `QuantityControl`, `DeckListPanel`, `views/*`, hover `CardFacePreview`), `StartScreen.tsx`, `styles.css` | Four view renderers; shared stepper; single-card modal; hover face-preview (text views); wire into StartScreen with the "View in deckbuilder" bridge + unsaved-changes guard. |

No change to `StartConfig` (`deck: number[]`) or the engine's game loop.

## Open questions / to refine — all resolved

- **View modes:** four — Simple named list · **Detailed list (default)** · Visual
  list · Visual + detail (full notes; tall rows fine; responsive notes column).
- **Search/sort:** full-text (name+rules) + chips; sort by value/rarity/name/color
  (asc/desc); grouped sections with counts by the active sort key.
- **Add/edit:** obvious **[+ Add]** → **`− [X] +`** stepper with editable box;
  0 / last-subtract removes.
- **Detail surface:** click card body → **single-card** full-detail modal (no
  Prev/Next; X/Esc/click-out). Hover → face-only preview, text views only.
- **Rosewater notes:** pulled into data this feature (build tool →
  `data/card-notes.json`; optional `CardData.notes`; joined at load); shown in full.
- **Standard-deck reminder:** calm informational note at the top; appears when the
  deck isn't the standard 45 / 23-14-6-2; never blocks; duplicates not flagged.
- **Validity:** hard 15-card (2p) minimum gates Start; the reminder never blocks.
- **Persistence:** localStorage named decks + text import/export (paste-in;
  copy-to-clipboard + download). Unsaved edits → **save-or-discard prompt** on
  navigate-away; starting a game doesn't prompt.
- **Import:** **name only** (no collector-number refs); lenient + reported.
- **Random deck:** sibling tab + **"View in deckbuilder"** bridge with seed
  round-trip.
- **Pre-Game Config:** constraints seam only.
- **Mobile:** out of scope → `docs/features/mobile-responsive.md`.
</content>

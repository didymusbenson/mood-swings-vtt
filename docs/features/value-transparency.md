# Feature: Value Transparency (computed value in Preview)

> **Status:** Refined (first pass).

## Summary

Many moods have *calculated* values (variable black dice, suppression→0, copy,
count-based queries like `moodiest` / `most common color` / `total value`), so a
number on the board can be hard to trust or understand. Surface a card's
**computed value** so players can see what a card is currently worth.

## Brief (captured)

- The transparency lives in the **Preview** area.
- When a player is looking at (inspecting) a card **that is on the field**, the
  Preview shows that card's **computed value** — i.e. its current, calculated
  value in the present board state, not just the printed die value.

## Spec (refined)

Split the Preview into two stacked regions:

- **Bottom — printed-card details** (unchanged, static): the existing card facts
  — color, value, secondary value, rarity — and the printed rules text. These
  describe the card as printed, regardless of board state.
- **Top — game-state details** (new, dynamic): reflects the previewed card's live
  state, including **where it currently is**. What shows depends on the card's
  zone:
  - **In play (a mood):**
    - **Controlled by:** which player currently controls the mood.
    - **Current value:** the computed value in the present board state.
    - **Modifying rule highlighted:** when the card's *own* text drives its value,
      the specific clause of its rules text is highlighted (e.g. Animosity below).
    - **Modified by {cardname}:** when the value is changed by **another** card
      (e.g. suppression or a value-drop from a different mood), show explanation
      text under Current value naming the responsible card — e.g.
      *"Modified by Disgust."* (More than one modifier may apply.)
  - **In a hand:** e.g. **"In your hand"** (or which player's hand).
  - **In the discard pile:** e.g. **"In discard."**
  - (Other zones/states may matter too — e.g. in the deck; see open questions.)

> Note: this reorganization (printed details on the bottom, live game-state on
> top) may be the fiddly part.

### Worked example — Animosity

Preview of **Animosity** (While in play — this mood's value is `[5]` if any
opponent has three or more cards in hand), while in play and that condition is
met:

- **Controlled by:** Player 2
- **Current value:** 5
- The clause *"…any opponent has three or more cards in hand…"* is **highlighted**
  in the rules text.

(The bottom region still shows the printed details: Color Red, Value/Secondary
dice, Rarity Uncommon, and the full printed rules text.)

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can bleed
into other features.)_

### Things Claude wants to ask about

- **Highlight mechanism.** Identifying *which clause* to highlight means mapping a
  computed value back to the specific rule/condition that produced it. The engine
  computes values but may not currently expose that provenance — likely the "pain"
  called out above. How precise should the highlight be (exact clause vs. whole
  rules text)?
- **Live updates.** If the board changes while a card is previewed, does the
  game-state region update live, or is it a snapshot?
- **Zone coverage.** Confirmed zones so far: in play, in a hand, in discard. What
  about a card in the **deck** (usually unknown/hidden) — show nothing, or "In
  deck"? And do we distinguish *your* hand vs. an opponent's (relevant once v2
  hidden-hand exists)?
- **Which zone details matter per zone.** Beyond location, are there other
  per-zone states worth surfacing (e.g. suppressed/rotated for an in-play mood,
  "playable from discard" for a discard card)?
- Relationship to the Animations **point-value reveal** — the reveal is the moment
  a value appears after a play; this is the persistent inspect view. Shared
  component/formatting?

**Resolved:**
- Preview = printed details (bottom) + game-state details (top).
- The top region is **location-aware**: for a mood in play it shows Controlled by
  / Current value / modifying-rule highlight; for other zones it shows where the
  card is (e.g. "In your hand", "In discard") rather than being omitted.
- **External modifiers** get an explanatory **"Modified by {cardname}"** line
  under Current value (self-modification uses the rules-text highlight instead).

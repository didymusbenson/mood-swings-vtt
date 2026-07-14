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
- **Top — game-state details** (new, dynamic): shown when the previewed card is a
  **mood in play**. It reflects the card's live state on the board:
  - **Controlled by:** which player currently controls the mood.
  - **Current value:** the computed value in the present board state.
  - **Modifying rule highlighted:** the specific clause of the rules text that is
    currently driving/modifying the value is highlighted.

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

- **External modifiers.** The Animosity example is *self*-modification (the card's
  own text drives its value). But a value can be changed by **another** card —
  suppression from an opposing mood, a value-drop from someone else's while-in-play
  effect, a count-based query, etc. In those cases the modifying rule isn't on the
  previewed card. What do we highlight then — nothing on this card, a "modified by
  {other card}" note, or a pointer to the responsible mood?
- **Highlight mechanism.** Identifying *which clause* to highlight means mapping a
  computed value back to the specific rule/condition that produced it. The engine
  computes values but may not currently expose that provenance — likely the "pain"
  called out above. How precise should the highlight be (exact clause vs. whole
  rules text)?
- **Live updates.** If the board changes while a card is previewed, does the
  game-state region update live, or is it a snapshot?
- **Hand/discard.** For a card not in play, is the game-state (top) region simply
  omitted, leaving only printed details? (Assumed yes.)
- Relationship to the Animations **point-value reveal** — the reveal is the moment
  a value appears after a play; this is the persistent inspect view. Shared
  component/formatting?

**Resolved:** Preview = printed details (bottom) + game-state details (top:
Controlled by, Current value, modifying-rule highlight); game-state region applies
to **moods in play**.

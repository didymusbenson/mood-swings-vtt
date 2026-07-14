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
- **Top — game-state details** (new, dynamic):
  - **In play (a mood):**
    - **Controlled by:** which player currently controls the mood.
    - **Current value:** the computed value in the present board state.
    - **Modifying rule highlighted:** when the card's *own* text drives its value,
      the specific clause of its rules text is highlighted (e.g. Animosity below).
    - **Modified by {cardname}:** when the value is changed by **another** card
      (e.g. suppression or a value-drop from a different mood), show explanation
      text under Current value naming the responsible card — e.g.
      *"Modified by Disgust."* (More than one modifier may apply.)
  - **Being considered for play (a card in hand):** the Preview reflects **what
    the card's state will be when it is played** — its *would-be* computed value
    and *would-be* modifiers (same self-highlight and/or "Modified by {cardname}"
    treatment), as if it entered play now. This lets a player weigh the effect of
    playing it before committing.
  - **No plain location labels.** We do **not** show "in your hand" / "in discard"
    zone text — decided out as noise that doesn't matter. The only reason to react
    to a hand card is the would-be projection above.

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

## Score explanation in the game log

The value transparency also extends to the **game log**: each round's entry should
carry an **explanation of the scores** (how each player's round total was arrived
at).

- **Collapsed by default** — the log stays compact.
- **Click the round to expand** it, revealing that round's score explanation.

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
- **Would-be scope.** The projection is framed around a hand card being considered.
  Does it also apply to cards **playable from the discard pile** (some cards can
  be)? And how is the "considered" card chosen — hover, select?
- **Would-be fidelity.** A card's *After playing this mood* effects can move cards
  around and re-settle values; should the would-be value account for the full
  post-play resolution, or just the entering value + while-in-play at the moment?
- **Log score explanation depth.** Per round, is the explanation a per-player total
  with each contributing mood and its computed value (and modifiers), or something
  lighter? Does it reuse the same value/modifier presentation as the Preview?
- Relationship to the Animations **point-value reveal** — the reveal is the moment
  a value appears after a play; this is the persistent inspect view. Shared
  component/formatting?

**Resolved:**
- Preview = printed details (bottom) + game-state details (top).
- In-play mood: Controlled by / Current value / modifying-rule highlight.
- **External modifiers** get an explanatory **"Modified by {cardname}"** line
  under Current value (self-modification uses the rules-text highlight instead).
- **No plain zone labels** ("in your hand" / "in discard" dropped as noise).
- Instead, a hand card being considered shows a **would-be** projection: the value
  and modifiers it would have when played.
- The **game log** gains a per-round **score explanation**, collapsed by default
  and expanded by clicking the round.

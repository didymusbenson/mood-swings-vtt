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
  - **Being considered for play (a card in hand):** the Preview shows a *would-be*
    computed value + modifiers, but **only from information that is static and
    already known** — i.e. the value the card would have on entry given the board
    **as it currently is**. Scope rules:
    - **No post-resolution projection.** Do not simulate how the board changes
      after the card enters (its *After playing this mood* effects, re-settling,
      chains). Just the current computed value before any board changes happen.
    - **No target-dependent projection.** If the would-be value depends on which
      targets the player would choose, don't show it.
    - **Do show static field modifiers.** If something already on the field would
      statically modify the card (e.g. an opposing mood that suppresses/drops a
      color or type currently in play), that's known information — reflect it.
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
- **Depth:** each mood with its computed value — **no deeper than that** (no
  modifier breakdown in the log; that detail lives in the Preview).

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can bleed
into other features.)_

### Would-be edge cases to rule on

These test whether "current computed value, static/known only" is fully defined:

1. **Self-inclusion in count-based values (the big one).** Many values depend on
   counts the card's own entry changes — "moods in play", *moodiest*, *most common
   color*, "you have more moods than…". Example: Superiority is `[6][1]` if you
   have more moods in play. If you have 2 and the opponent has 3, playing
   Superiority makes it 3–3. Does the would-be count the card **as if already in
   play** (include itself) or evaluate against the board **without** it? "State
   when played" argues include-self; "before board changes" argues exclude-self —
   these conflict, so this needs an explicit call.
2. **This-turn / secondary values.** Patience is `[5]` normally but `[1]` the turn
   it's played. Since it *would* be played this turn, the would-be value should be
   the this-turn face (`[1]`), then it'd become `[5]` next turn. Confirm the
   would-be shows the this-turn value. (Deterministic, not target-based — a good
   fit for would-be.)
3. **Play costs.** Some cards cost board changes to play (e.g. Self-Loathing:
   discard one of your moods to play it; cards that return moods to hand). Paying
   the cost changes counts *before* the card enters, and which mood you sacrifice
   is a player choice. Per the rules above this is target/board-change dependent →
   the would-be **ignores costs**. Confirm.
4. **Copy (Creativity).** Creativity's value is whatever mood it copies — a target
   choice. Target-dependent → no would-be value projected (show its base/none until
   played). Confirm.
5. **External modifier flipped by the card's own entry.** An opposing mood that
   "suppresses the most common color" might start applying (or stop) once your card
   enters and shifts which color is most common. Same crux as #1 — resolved by the
   self-inclusion ruling.
6. **v2 hidden information.** Animosity keys off opponent *hand size* (a count —
   public). A future card keying off hidden *hand contents* couldn't be projected
   in v2. Note only: would-be uses public/known info; skip if it needs hidden info.

### Other open questions

- **Highlight mechanism.** Identifying *which clause* to highlight means mapping a
  computed value back to the specific rule/condition that produced it. The engine
  computes values but may not currently expose that provenance — likely the "pain"
  called out above. How precise should the highlight be (exact clause vs. whole
  rules text)?
- **Live updates.** If the board changes while a card is previewed, does the
  game-state region update live, or is it a snapshot?
- **Would-be trigger.** How is the "considered" hand card chosen — hover, select?
  And does the projection also apply to cards playable from the **discard pile**?
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
  and modifiers it would have when played, but **only from static/known info** —
  no post-play resolution, no target-dependent outcomes; static field modifiers
  already in play **are** shown.
- The **game log** gains a per-round **score explanation**, collapsed by default
  and expanded by clicking the round; depth = **each mood with its computed
  value**, no deeper.

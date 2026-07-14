# Feature: Value Transparency (computed value in Preview)

> **Status:** Refined (first pass).

## Summary

Many moods have *calculated* values (variable black dice, suppression→0, copy,
count-based queries like `moodiest` / `most common color` / `total value`), so a
number on the board can be hard to trust or understand. Surface a card's
**computed value** so players can see what a card is currently worth.

> **Guiding principle:** value transparency is **consistent across the whole game
> interface**, not just the Preview and log. Wherever a value appears — board
> tiles, the Preview, the decision modal, the log — a computed/modified value is
> shown and marked as such. The Preview and log are the deepest surfaces, but the
> treatment (e.g. the computed-value indicator) applies everywhere a value renders.

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
  - **A card in your hand (would-be value):** any hand card whose value is
    **objectively computable** shows its *would-be* value **at all times** — not
    only when previewed (see *Always-on computation* below). This uses **only
    information that is static and already known** — the value the card would have
    on entry given the board **as it currently is**. Scope rules:
    - **Self-include.** The card counts **itself** as if already in play — playing
      it *is* a fact, so count-based values reflect its own presence. E.g. you have
      2 moods and the opponent has 3; the would-be for Superiority (`[6][1]` if you
      have more moods in play) reflects the 3–3 board its entry creates. (Implements
      as a dry-run of the engine's existing `stabilise()` fixpoint with the card
      hypothetically added.)
    - **This-turn values apply.** If a card has a "this turn it's played" value
      (e.g. Patience is `[5]` normally but `[1]` the turn played), the would-be
      shows the **this-turn** value (`[1]`).
    - **No post-resolution projection.** Do not simulate how the board changes
      after the card enters (its *After playing this mood* effects, re-settling,
      chains) — only the direct consequence of it entering.
    - **No target-dependent projection.** If the would-be depends on which targets
      the player would choose, don't show it (but see the decision-modal preview
      below, where selections *are* known).
    - **Play costs are unknowable.** Costs that change the board to play the card
      (e.g. Self-Loathing discarding one of your moods) are player choices → the
      would-be **ignores costs**.
    - **Do show static field modifiers.** If something already on the field would
      statically modify the card (e.g. an opposing mood that suppresses/drops a
      color or type currently in play), that's known information — reflect it.
  - **No plain location labels.** We do **not** show "in your hand" / "in discard"
    zone text — decided out as noise that doesn't matter. The only reason to react
    to a hand card is the would-be projection above.

> Note: this reorganization (printed details on the bottom, live game-state on
> top) may be the fiddly part.

## Always-on computation & Preview triggers

**Always-on computation.** Every card that *can* have an objective computed value
**is** computed and displayed — whether or not it's in the Preview — unless doing
so proves overwhelmingly taxing on the engine. So a hand card's objective would-be
value and the computed-value indicator are visible on the card itself, not gated
behind opening the Preview.

- "Objective" = derivable from static/known state with no player choices: the
  self-included would-be, this-turn values, and static field modifiers all
  qualify. **Target/cost-dependent** values (e.g. Creativity's copy target) are
  *not* objective, so they aren't computed passively — they resolve in the
  decision-modal preview once the choices are made.
- Fixed-value cards (plain white die, no dynamic logic) need no computation; they
  just show their printed value.
- **Engine-cost caveat:** a would-be is a dry-run of the existing `stabilise()`
  fixpoint with the card hypothetically added; one per dynamic-value hand card per
  state change. Expected to be cheap (small fixpoint over moods in play), but this
  is the "unless overwhelmingly taxing" escape hatch if profiling says otherwise.

**Opening the Preview (detail panel).** The detailed Preview is triggered by:

- **Mouse:** hovering a card for **more than 1 second**.
- **Touch / click:** a tap or click triggers it **instantly** (mobile-friendly).

Designating a card for *play* is a separate gesture (click-then-"Play", or
press-and-drag onto the field) and always runs the computation too — but since
computation is always-on, no special "considering" state is needed for it.

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

## Computed-value indicator (on the card itself)

Beyond the Preview, a card should *visually signal* when its value is computed /
modified rather than its printed default:

- A card whose current value is **computed or modified** (differs from its printed
  die, or is dynamically derived) renders its value with a **glow / highlight**
  (or similar treatment) marking it as computed.
- A card whose value is **unmodified** renders its plain default die symbol as
  today.
- **Inspiration:** Slay the Spire's treatment of upgraded cards / modified costs —
  a modified number is visually distinguished from its default so the player knows
  at a glance it isn't the printed value.

## Pre-submit computed preview (during target/cost decisions)

For cards that require choices to submit (targeting, costs), let the player make
**all** their selections and *then* see the resulting computed value **before they
hit Submit** — so they commit with full knowledge.

- The card being played appears in the **decision modal**, on the **left-hand side
  like a Preview**, labeled **"Playing {CARDNAME}"**.
- As the player makes selections, the **preview updates** to reflect them —
  including the resulting computed value.
- This is the one place target-dependent outcomes *can* be shown, because the
  targets/costs are now known (chosen), unlike the passive would-be projection for
  a card sitting in hand.
- Builds on the existing modal targeting overlay (F4), which already holds the
  played card in the Preview rail.

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

### Would-be edge cases — rulings

1. **Self-inclusion — RULED: include self.** The card counts itself as if in play
   (playing it is a fact). Superiority previewed at a 2-vs-3 board shows the value
   for the 3–3 board its entry creates.
2. **This-turn / secondary values — RULED: show this-turn value.** Patience's
   would-be is `[1]` (its this-turn face), not `[5]`.
3. **Play costs — RULED: ignore.** Costs represent unknown/unknowable choices; the
   would-be doesn't attempt to reflect them.
4. **Copy (Creativity) — RULED (implied): target-dependent, no passive would-be.**
   Its value depends on which mood it copies (a choice), so it isn't projected in
   the hand preview. It *would* resolve in the decision-modal preview once the copy
   target is chosen. (Flag if you want it handled differently.)
5. **External modifier flipped by the card's own entry — RULED via #1.** Because we
   self-include, an opposing "suppress the most-common-color" that starts/stops
   applying due to this card's entry is reflected.
6. **v2 hidden information — noted.** Would-be uses public/known info only; a value
   depending on hidden info (once v2 hides hands) simply isn't projected.

### Other open questions

- **Highlight mechanism.** Identifying *which clause* to highlight means mapping a
  computed value back to the specific rule/condition that produced it. The engine
  computes values but may not currently expose that provenance — likely the "pain"
  called out above. How precise should the highlight be (exact clause vs. whole
  rules text)?
- **Live updates — likely resolved.** The engine's `stabilise()` keeps every
  mood's `currentValue` live in state (recomputed on every play, at scoring, and
  after draws), so the Preview just reads the current value — no snapshotting
  needed. Confirm no special handling wanted.
- **Would-be scope beyond hand.** Does the always-on would-be also apply to cards
  playable from the **discard pile** (some are), and to whose hand — active
  player's only, or any hand card inspected?
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
  and modifiers it would have when played, from **static/known info** — **self
  included** (counts itself as in play), **this-turn values** shown, **costs
  ignored**, no post-play resolution, no target-dependent outcomes; static field
  modifiers already in play **are** shown.
- A **computed-value indicator** glows/highlights a card's value when it's
  computed/modified vs. its printed die (Slay-the-Spire-style); unmodified values
  render the plain default.
- A **pre-submit computed preview** in the decision modal: the card being played
  shows on the modal's left as "Playing {CARDNAME}" and updates the computed value
  live as targets/costs are selected, so the player sees the result before Submit.
- The **game log** gains a per-round **score explanation**, collapsed by default
  and expanded by clicking the round; depth = **each mood with its computed
  value**, no deeper.
- **Always-on computation:** every card with an objective computation is computed
  and shown whether previewed or not (engine cost permitting). Preview detail opens
  on **mouse hover >1s** or an **instant tap/click** (mobile-friendly). No separate
  "considered for play" designation is needed — computation is always live.

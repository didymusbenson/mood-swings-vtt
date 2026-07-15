# Feature: Animations

> **Status:** Iteration 1 shipped — round-boundary cinematics, mood-played
> landing + point-value reveal, and drag-to-play pre-commit feedback are live and
> runtime-verified. Remaining brief items are deferred (see below).

## Implemented (iteration 1)

Driven off the engine's append-only `log` plus the structured view fields
(`round`/`phase`/`winner`) — **not** off diffing arbitrary React state. This is
deliberate and load-bearing for V2: a networked client receives exactly these
same (redacted) values, so the cinematics port unchanged.

- **The event-stream spine.** `game/animations.ts` (`deriveCinematics`, pure +
  unit-tested) turns each state transition's new log entries into an ordered cue
  list; `hooks/useGameEvents.ts` queues them; `components/Cinematic.tsx` renders
  them. This hook is the seam V2 reuses ("new state from dispatch" → "redacted
  view from server").
- **Round-start callout** — full-screen `ROUND N` + `[player] plays first`,
  fly-in over a dark scrim.
- **Round-end / scoring** — full-screen staggered score tally, then the round
  winner.
- **Victory** — distinct match-end champion callout (lingers until dismissed).
- **Mood played** — the tile "lands" as it enters play (`card--entering`, keyed
  on a newly-seen mood uid).
- **Point-value reveal** — the value pops in *after* the landing, animating the
  **shared** `DiceValue` element (Value Transparency), so it looks identical
  animating in vs. sitting static.
- **Drag-to-play pre-commit feedback** — the battlefield reads an unmistakable
  "release here to play" (breathing green wash + lifted label) and the held ghost
  gets a pulsing ring, all *before* the player commits.
- **Pass indicator** — a brief, non-blocking flash when a player passes.
- **Skippable + reduced-motion** — every cinematic is click/Esc-to-continue with
  an auto-advance ceiling; `prefers-reduced-motion` collapses motion while
  keeping everything legible.

## Deferred (next iterations)

- **Effect-driven zone-change flights** (cards animating deck↔discard↔hand↔play).
  Needs richer per-card events than the log carries today; the opponent-redacted
  slice of this genuinely belongs to V2.
- **Value recomputation mid-round** — in-play moods animating a value change on a
  fixpoint recompute.
- **Card draw** animated deck→hand; **per-move score-tick** on the board.
- **Sequencing of chained effects** (queue/overlap/log-order) and a global
  animation-speed control (see `settings.md`).

---

> **Original brief (captured).** Retained below for reference.

## Summary

The game is largely functional, but the gameplay loop feels rough because the
only feedback is static (the log, highlights). Add animations so players can
*see* what's happening as it happens.

## Brief (captured)

### Round-boundary animations (full-screen)

- **Round start:** a full-screen callout announcing the round and turn order,
  e.g. `ROUND 1 — [PLAYER] PLAYS FIRST`.
- **Round end / scoring:** after both players have finished their turns and any
  per-move score animations have completed, a full-screen sequence shows each
  player's score, then declares the round winner.
- **Visual treatment (both):** a dark overlay with fly-in text that ease-in /
  ease-out settles at the center of the screen.

### In-play animations

- **Mood played:** the card animates "landing" as it enters play.
- **Effect-driven zone changes:** when an effect moves cards (to the deck,
  discard, or a hand), those cards animate their zone change.
- **Point value reveal:** a played card's point value appears *after* it has
  landed and its effect has finished resolving. For many moods this is a
  *calculated* value, so the reveal reflects the computed number.
  - **Shared element with Value Transparency:** the reveal animates the *same*
    computed value/die graphic component used across the interface (see
    `value-transparency.md`), not a separate one — so the number looks identical
    animating in vs. sitting on the board / in the Preview.

### Interaction feedback (drag-to-play)

- **Pre-commit drag feedback:** when a player drags a card toward the
  battlefield, there must be enough visual feedback to signal *"releasing here
  will play this card"* **before** they commit — so an unintentional drag is
  obvious in time to abort it.

> **Note — misclick recovery (no undo):** This is a player-vs-player game, so
> there is **no undo** feature. Misclick recovery is handled entirely at the
> point of action: the **Play / Submit** button confirms, and for cards that
> require choices **Cancel** backs out; drag-to-play gets the pre-commit feedback
> above so a stray drag can be avoided rather than reversed.

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can bleed
into other features.)_

### Animations Claude wants to ask about

- Sequencing/timing: what happens if effects chain or resolve to a fixpoint —
  do zone-change animations queue, overlap, or play in log order?
- Can animations be skipped, sped up, or interrupted (e.g. a "click to
  continue" or a global speed/reduced-motion setting)?
- Card **draw** at start of round / on draw effects — animated from deck to
  hand?
- **Pass** action — is there any indicator/animation when a player passes
  instead of playing?
- **Value recomputation** mid-round (black/variable dice) — do already-in-play
  moods animate their value changing when something causes a recompute?
- Score-tick animation on the board (per-move) vs. the full-screen end-of-round
  tally — how do these two relate/hand off?
- **Match end** (first to 3 rounds) — is there a distinct final/victory
  animation beyond the round-winner one?
- Highlights/targeting: should target selection or effect resolution get motion,
  or stay as static highlights?

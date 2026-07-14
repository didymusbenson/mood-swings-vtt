# Feature: Animations

> **Status:** Stub — brief captured, not yet refined.

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

# Feature: Play Discarded v2

> **Status:** Stub — brief captured, not yet refined. **Priority: low** (v1 works).

## Summary

Playing moods from the discard pile already works (Grief/Angst/Harmony/Grace,
Melancholy) — see **F13** in `feedback.md`. In v1 the discard **pile** lights up
when a discard-play is available and clicking it opens the discard **inspector**,
where the legal cards are highlighted and clickable.

v2 upgrades the *presentation*: instead of tucking playable discard cards behind a
pile + modal, surface the discard pile as a **second hand for the active player** —
a distinct, clearly-marked zone of playable cards sitting alongside your real hand —
so a discard-play reads as a first-class option, not a hidden one.

## Brief (captured)

- When the active player has a discard-play available, render the **playable discard
  cards as a second hand** (a fanned/laid-out row of cards you can play directly),
  in addition to your normal hand.
- Give the zone a **clear "special zone" indicator** — a glow, a label
  (e.g. "From the discard"), a tinted backing, or similar — so it's obvious these
  are discard-sourced plays, not your regular hand.
- Cards in this second hand are **played the same way** as normal hand cards
  (tap/drag), routing through the existing `from: 'discard'` play path.
- Only the **legal** discard cards appear (reuse `queries.legalDiscardPlays`); the
  zone appears only while a discard-play is actually available and hides otherwise.

## Related

- **v1 (shipped):** `feedback.md` F13 — discard pile lights up + inspector plays
  legal cards. Engine legality helper: `queries.legalDiscardPlays`.
- **Layout:** the current bottom edge already floats info/actions into the
  foreground (F11) and clips the oversized hand at the screen edge — a second hand
  will need to share that bottom space (or dock elsewhere) without re-crowding the
  battlefield or overlapping the real hand.
- **Discard inspector** stays useful for *viewing* the full pile (non-playable
  cards, opponent turns); v2 is about the active player's *playable* subset.

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can bleed
into other features.)_

### Things Claude wants to ask about

- **Placement:** where does the second hand live — a row above/beside your real
  hand, a docked strip near the deck/discard column, or a pop-forward tray? How does
  it coexist with the bottom-clipped hand + floated info/action controls (F11)?
- **Distinguishing the zones:** what should mark it as special — glow colour (the
  green "playable" cue from v1?), a label, a different card backing/frame — and how
  do we keep your real hand vs. the discard hand unambiguous at a glance?
- **Count semantics:** should the zone show how many discard-plays remain
  (`discardPlaysRemaining`), and update/shrink as they're spent?
- **Ordering / size:** full-size playable cards like the real hand, or a more
  compact strip? Does it fan, scroll, or wrap when the discard is large?
- **Non-active / hotseat:** hidden entirely when it's not your turn (it's an
  active-player affordance), matching how the focal hand is treated?
- **Keep the pile affordance too?** Retain the pulsing pile + inspector as the way
  to browse the whole discard, with the second hand as the fast-play surface?

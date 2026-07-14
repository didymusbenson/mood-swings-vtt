# Feature: Value Transparency (computed value in Preview)

> **Status:** Stub — brief captured, not yet refined.

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

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can bleed
into other features.)_

### Things Claude wants to ask about

- Depth: just the final computed number, or also a **breakdown** of how it was
  derived (base die + modifiers, suppression, copy, count-query result)?
- Secondary value: does the Preview show the secondary value too, and its
  computed form?
- Does this apply only to on-field moods, or also to cards in hand / discard
  (where "computed" may not be meaningful)?
- Relationship to the Animations **point-value reveal** — the reveal is the
  moment a value appears after a play; this is the persistent inspect view.
  Shared component/formatting?

# Feature: Deckbuilder Overhaul

> **Status:** Stub — brief captured, not yet refined.

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

> **TODO:** Check the rules for **deckbuilding constraints** (custom-deck
> minimums / limits) and wire them into the builder — see `REQUIREMENTS.md` and
> `docs/RULES.md`.

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can bleed
into other features.)_

### Things Claude wants to ask about

- What fields count as "more general detail per card" (value/secondary value,
  color, effect text, MR clarifications, art)?
- What does search cover — name only, or effect text / color / value ranges too?
  Any filter chips (by color, by value, etc.)?
- Deck-list validity feedback: should the builder show live pass/fail against
  the deckbuilding constraints, and can you start a game with an invalid deck?
- Copy limits: is there a max number of copies per card, and where does the
  count come from (rules vs. box collation)?
- How does this relate to the existing **Random deck** generator — shared UI,
  or a separate entry point?
- Save/load or persistence of a built deck between sessions?

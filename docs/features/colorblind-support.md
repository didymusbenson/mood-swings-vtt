# Feature: Colorblind Support

> **Status:** Stub — brief captured, not yet refined. **Priority: low.**

## Summary

Mood Swings is a color-based game — moods have colors, and card effects query
color directly (e.g. "most common color", color-match constraints). That makes
color legibility more load-bearing here than in a typical app, so colorblind
support is worth its own (low-priority) feature.

## Brief (captured)

- Provide colorblind support so color-dependent information remains
  distinguishable for colorblind players.
- Low priority.

> Note: broader accessibility (keyboard nav, screen-reader, etc.) and sound are
> **out of scope for now** — this feature is scoped to color legibility only.

## Related

- A toggle for this would live in **Settings** (see `settings.md`).

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can bleed
into other features.)_

### Things Claude wants to ask about

- Approach: redundant encoding (labels / patterns / symbols alongside color),
  alternate palettes, or both?
- Which surfaces matter most (card colors, mood grouping, targeting highlights,
  "most common color" indicators)?

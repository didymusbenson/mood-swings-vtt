# Feature: Mobile & Responsive Support

> **Status:** Deferred — placeholder. **Scoped only after the desktop experience
> is complete.** Captured now so the debt is explicit; not to be worked until
> desktop features (deckbuilder overhaul, value transparency, etc.) are settled.

## Why this exists

Development has moved a long way with **desktop as the assumed target** — the
battlefield layout, the deckbuilder, previews, and targeting overlays are all
tuned for a wide pointer-driven screen. Rather than retrofitting mobile
piecemeal into each feature, mobile/responsive behaviour is pulled out into a
**single dedicated feature** to be designed as a coherent pass once desktop is
locked.

## Scope (to refine later)

Not yet specced. Likely surfaces when this is picked up:

- Responsive battlefield / playfield layout (no horizontal scroll on phones).
- Touch-first interactions (the codebase already has some tap/pen handling in
  `useHandDrag` / preview triggers — audit and unify).
- The **deckbuilder** on a narrow screen: the three-region workspace (browser +
  deck-list rail) and the four view modes need a stacked/compact layout; the
  detail **modal** is already touch-friendly and is the natural mobile detail
  surface.
- Preview / decision-modal ergonomics on small screens.

## Open questions

_(To be filled when this is picked up — after desktop is complete.)_

- Target breakpoints / minimum supported width.
- Phone vs. tablet priority.
- Which desktop interactions have no sensible touch equivalent and need a
  redesign vs. a straight reflow.
</content>

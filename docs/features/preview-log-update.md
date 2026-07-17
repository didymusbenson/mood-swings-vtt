# Feature: Preview / Log Panel Merge

> **Status:** Stub — brief captured, not yet refined.

## Summary

Merge the two dedicated right-hand-side panels — the card **Preview**
(`PreviewPane.tsx`) and the **Activity Log** (`ActivityLog.tsx`) — into a
single shared column where the log currently lives. Today `GameBoard.tsx`
renders them as separate left/right panels in a three-column grid
(`.board { grid-template-columns: 264px minmax(0, 1fr) 300px; }` in
`styles.css`). Under this change, the left preview column goes away; the
**Preview** occupies the right-hand column at full detail by default, and
the **Activity Log** becomes a fly-up panel anchored to the bottom of that
same column, layered over the preview rather than pushing it around.

## Brief (captured)

- New right-hand column: **`PreviewComponent`** fills the column at full
  detail (image, name, color, value, rarity, rules text, etc. — as today's
  `PreviewPane.tsx`) by default. The preview's own content/detail level is
  **not** toggled by the player — it always shows full detail when a card
  is being previewed.
- **`ActivityComponent`** (the log) lives in the same column as a
  **fly-up**: collapsed, it sits docked to the bottom of the column (a
  slim strip/handle), leaving the preview fully visible above it. Expanded
  (dragged/tapped/toggled upward), it rises to **cover some or all of the
  preview area**, as an overlay on top of the preview rather than
  resizing or displacing it.
  - The player controls how far up it rises — partial (covering only the
    bottom portion of the preview) or full (covering the whole column) —
    to read as much log as they want at a given moment.
  - When expanded, the log scrolls within itself as it does today.
  - Collapsing it back down returns the preview to full, unobstructed
    visibility.
- **Auto behavior during overlays:** when a card-play flow or other
  full-board overlay is active (e.g. `TargetOverlay`/`pc.flow`), the log
  fly-up is automatically **hidden or collapsed** so it doesn't compete
  with or obscure that overlay. Once the overlay dismisses, the log
  **returns to whatever position it was in before** (collapsed or
  expanded) rather than resetting to a default.
- Net effect: the preview is always the "resting state" of the column,
  fully visible and undiminished; the log is an on-demand layer the player
  pulls up only when they want to consult it, and it gets out of the way
  automatically during moments (overlays) where it would otherwise
  conflict with more important on-screen information.

## Related

- `packages/app/src/components/GameBoard.tsx` — current three-column
  layout (`PreviewPane` left, `playfield` center, `ActivityLog` right);
  becomes a two-column layout (`playfield`, merged right column with the
  log fly-up layered over the preview).
- `packages/app/src/components/PreviewPane.tsx` — current preview
  rendering logic; stays at full detail, is not gated behind a toggle
  under this design. Also has a `floating` mode (used during
  targeting/`TargetOverlay` to show live would-be values) that needs to
  keep working underneath/alongside the fly-up.
- `packages/app/src/components/ActivityLog.tsx` / `packages/app/src/game/log.ts`
  — current log rendering and data; becomes the fly-up's content, same
  independent-scroll behavior as today.
- `packages/app/src/styles.css` — `.board` grid-template-columns (line
  ~782) and the narrow-viewport single-column collapse (line ~2407)
  will both need updating for the new two-column layout with a layered
  (not stacked) log.
- No existing overlay/drawer/"fly-up" component exists in
  `packages/app/src` today (closest analogs are the show/hide `Modal.tsx`
  and `PreviewPane`'s own `floating` positioning) — this feature likely
  needs a new primitive for a draggable/toggleable bottom-anchored
  overlay with partial and full extents.
- `mobile-responsive.md` — the narrow-viewport single-column board layout
  may interact with this change; worth cross-checking during refinement.

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can
bleed into other features.)_

### Things Claude wants to ask about

- Expand/collapse interaction: drag handle (touch/mouse drag on the
  fly-up's edge), a tap/click toggle between fixed collapsed/expanded
  states, or both (tap to fully expand, drag for partial)?
- How many discrete positions does the fly-up support — just
  collapsed/expanded, or a continuous/partial range the player can stop
  at anywhere in between?
- Does the collapsed strip show anything (e.g. the latest log entry, an
  unread-entries badge) so the player can tell something happened without
  expanding it, or is it a plain closed handle?
- While the log is expanded and covering the preview, if the player
  hovers/selects a new card to preview, does the log auto-collapse to
  reveal it, or does the new preview content just wait underneath until
  the player collapses the log themselves?
- "Returns to whatever position it was in before" after an overlay
  dismisses — does that mean literally the same expand/collapse state, or
  always back to collapsed (safest default, resting state = preview
  visible)?
- Interaction with `PreviewPane`'s existing `floating` mode during
  targeting (`TargetOverlay`) — is the log fly-up force-collapsed for the
  full duration of that flow, and does floating-preview z-index stacking
  need to change relative to the fly-up?
- Any change to the existing `CardDetailModal.tsx` (full-card modal)
  behavior, or does that remain a separate, unrelated affordance?
- Right-hand column target width now that it no longer competes with a
  separate 264px left preview panel — same ~300px, or does it change?
- Mobile/narrow-viewport behavior: does a bottom-anchored fly-up over the
  preview still make sense at the width where `mobile-responsive.md`
  currently caps both panels at 360px, or does mobile need a different
  pattern (e.g. a full-screen log sheet)?
- Accessibility: keyboard/focus handling for expanding, collapsing, and
  reading the log without a mouse-drag gesture; screen-reader
  announcement when the log auto-collapses/reappears around an overlay.

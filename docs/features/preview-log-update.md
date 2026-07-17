# Feature: Preview / Log Panel Merge

> **Status:** Stub — brief captured, not yet refined.

## Summary

Merge the two dedicated right-hand-side panels — the card **Preview**
(`PreviewPane.tsx`) and the **Activity Log** (`ActivityLog.tsx`) — into a
single shared column where the log currently lives. Today `GameBoard.tsx`
renders them as separate left/right panels in a three-column grid
(`.board { grid-template-columns: 264px minmax(0, 1fr) 300px; }` in
`styles.css`). Under this change, the left preview column goes away; the
preview becomes the top item in a vertical stack on the right, with the
activity log below it.

## Brief (captured)

- New right-hand stack, top to bottom: **`PreviewComponent`**, then
  **`ActivityComponent`**.
- **Preview** appears by default in its own space at the top of the stack
  and populates with card info as today (image, name, color, value,
  rarity, rules text, etc. — see current `PreviewPane.tsx` fields).
- Preview has a **toggle/accordion control** for level of detail, with (at
  least) three levels:
  - **Image only**
  - **Image + description** (current full detail — the default)
  - **Hidden** (preview collapses out of the way entirely)
- **Activity Log** is the next item in the stack, directly below the
  preview.
  - The log **scrolls independently** within its own region — it does not
    scroll the whole right-hand column.
  - When the preview is fully expanded, the log is **pushed down** (not
    overlapped) — the preview always renders completely visible above it.
  - Shrinking the preview (via the detail-level control) gives the log
    more vertical room; setting the preview to **hidden** gives the log
    the most space.
- Net effect: one column replaces the current two, and the player controls
  the preview/log space trade-off directly via the preview's detail
  toggle instead of two independently-sized panels.

## Related

- `packages/app/src/components/GameBoard.tsx` — current three-column
  layout (`PreviewPane` left, `playfield` center, `ActivityLog` right);
  becomes a two-column layout (`playfield`, merged right stack).
- `packages/app/src/components/PreviewPane.tsx` — current preview
  rendering logic; source of the "image + description" full-detail view.
- `packages/app/src/components/ActivityLog.tsx` / `packages/app/src/game/log.ts`
  — current log rendering and data.
- `packages/app/src/styles.css` — `.board` grid-template-columns (line
  ~782) and the narrow-viewport single-column collapse (line ~2407)
  will both need updating for the new two-column layout.
- No existing accordion/collapsible/disclosure component exists in
  `packages/app/src` today (closest analog is the show/hide `Modal.tsx`,
  which isn't an inline pattern) — this feature likely needs a small new
  primitive rather than reusing something in place, unless one is
  introduced by another feature first.
- `mobile-responsive.md` — the narrow-viewport single-column board layout
  may interact with this change; worth cross-checking during refinement.

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can
bleed into other features.)_

### Things Claude wants to ask about

- Detail-level control: accordion (expand/collapse in place), a
  segmented toggle (Image / Image+Desc / Hidden), or a small icon button
  that cycles through the three states?
- Is the detail level a per-session UI preference (resets each game) or
  persisted (e.g. local storage, tying into `settings.md`)?
- When the preview is "hidden," does it disappear completely (log takes
  the full column) or collapse to a minimal header/placeholder that can
  be re-expanded?
- Does hovering/selecting a card while the preview is hidden or
  image-only temporarily auto-expand it, or does the player have to
  manually toggle it back?
- Fixed height for "image only" mode, or does it size to the image's
  natural aspect ratio?
- Any change to the existing `CardDetailModal.tsx` (full-card modal)
  behavior, or does that remain a separate, unrelated affordance?
- Right-hand column target width now that it no longer competes with a
  separate 264px left preview panel — same ~300px, or does it change?
- Mobile/narrow-viewport behavior: does the merged stack still collapse
  into the single-column board layout the same way the two separate
  panels do today?

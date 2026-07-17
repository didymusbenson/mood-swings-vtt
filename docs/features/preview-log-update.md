# Feature: Preview / Log Panel Merge

> **Status:** Stub — brief captured, not yet refined.

## Summary

Merge the two dedicated right-hand-side panels — the card **Preview**
(`PreviewPane.tsx`) and the **Activity Log** (`ActivityLog.tsx`) — into a
single shared column where the log currently lives. Today `GameBoard.tsx`
renders them as separate left/right panels in a three-column grid
(`.board { grid-template-columns: 264px minmax(0, 1fr) 300px; }` in
`styles.css`). Under this change, the left preview column goes away; the
**Preview** occupies the right-hand column at full detail, undiminished,
at all times. The **Activity Log** is no longer a panel at all — it's
summoned on demand via a **FAB (floating action button)**, which opens the
log as a transient overlay rather than living in any fixed layout slot.

## Brief (captured)

- New right-hand column: **`PreviewComponent`** fills the column at full
  detail (image, name, color, value, rarity, rules text, etc. — as today's
  `PreviewPane.tsx`) at all times. The preview is never toggled, shrunk,
  or covered by the log under this design.
- **`ActivityComponent`** (the log) is invoked via a **FAB** — a small
  floating circular/pill button (likely bottom-right of the board or
  bottom-right of the preview column) — rather than occupying a docked
  strip or column slot.
  - Tapping/clicking the FAB opens the log as an overlay (e.g. a
    bottom sheet, side drawer, or popover anchored to the FAB) on top of
    the board/preview.
  - Dismissing it (tap the FAB again, tap outside, or an explicit close)
    returns the board to its normal state — preview fully visible, no log
    on screen.
  - The FAB itself can carry a lightweight ambient signal (e.g. a badge
    or pulse) so the player can tell something happened in the log
    without opening it.
- **Auto behavior during overlays:** if the log overlay happens to be open
  when a card-play flow or other full-board overlay (e.g.
  `TargetOverlay`/`pc.flow`) needs to appear, the log overlay is
  dismissed automatically so it doesn't compete with it. The FAB itself
  (as an always-present affordance) remains visible/available throughout.
- Net effect: the preview keeps its full, permanent column with zero
  contention — nothing ever displaces or covers it. The log stops being a
  persistent layout element altogether and becomes a discrete,
  momentary/on-demand action, closer to a notifications or history
  drawer than a panel.

## Related

- `packages/app/src/components/GameBoard.tsx` — current three-column
  layout (`PreviewPane` left, `playfield` center, `ActivityLog` right);
  becomes a two-column layout (`playfield`, permanent full-detail
  preview column) plus a FAB rendered somewhere over the board that
  summons the log on demand.
- `packages/app/src/components/PreviewPane.tsx` — current preview
  rendering logic; stays at full detail, permanently, with no
  contention from the log under this design. Also has a `floating` mode
  (used during targeting/`TargetOverlay` to show live would-be values)
  — unaffected by the log's overlay since the log is no longer
  positioned relative to the preview at all.
- `packages/app/src/components/ActivityLog.tsx` / `packages/app/src/game/log.ts`
  — current log rendering and data; becomes the content of the
  FAB-triggered overlay, same independent-scroll behavior as today.
- `packages/app/src/styles.css` — `.board` grid-template-columns (line
  ~782) and the narrow-viewport single-column collapse (line ~2407)
  simplify somewhat since the log no longer needs a reserved column or
  row at all — it needs positioning for the FAB itself plus its overlay.
- No existing FAB, bottom-sheet/drawer, or popover-from-button component
  exists in `packages/app/src` today (closest analog is the show/hide
  `Modal.tsx`, which is centered/full-board rather than anchored to a
  trigger) — this is a new interaction primitive for the codebase.
- `mobile-responsive.md` — FABs are a well-established mobile pattern,
  so this direction may actually simplify the narrow-viewport story
  relative to earlier iterations; still worth cross-checking during
  refinement, especially FAB placement so it doesn't collide with other
  bottom-anchored controls (e.g. hand cards, the Pass button visible in
  the current board screenshot).

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can
bleed into other features.)_

### Things Claude wants to ask about

- FAB placement: bottom-right of the whole board, bottom-right of the
  preview column specifically, or somewhere else — and how does it avoid
  colliding with existing bottom-anchored UI (hand cards, the **Pass**
  button, player score/turn indicator)?
- Overlay shape when the FAB is tapped: bottom sheet (slides up from
  bottom, board width or column width), side drawer (slides in from the
  right), or a popover anchored directly above/beside the FAB? Each has
  different implications for how much of the board/preview it covers.
- Does opening the log overlay dim/block interaction with the rest of the
  board (modal-like, similar to `Modal.tsx`), or can the player still act
  on the board (hover cards, etc.) while it's open?
- Ambient signal on the FAB (badge/pulse for new entries) — what counts
  as "new" (since last open), and does it clear immediately on open or
  after the player actually scrolls to see the newest entry?
- Auto-dismiss when a full-board overlay (`TargetOverlay`/`pc.flow`)
  needs to appear — does the log overlay closing while the player is
  mid-read feel abrupt, and should there be any transition/warning, or is
  instant dismissal fine given it was only open briefly by nature of the
  FAB pattern?
- Does the FAB replace the log entirely, or is there still a compact
  "recent activity" indicator elsewhere (e.g. a one-line toast for the
  newest entry) so players get log info without needing to open anything?
- Any change to the existing `CardDetailModal.tsx` (full-card modal)
  behavior/precedent this FAB-and-overlay pattern should follow for
  consistency?
- Right-hand column width now that it's solely the preview's — does it
  stay ~300px, shrink, or grow now that it no longer needs to
  accommodate log content at all?
- Mobile/narrow-viewport behavior: does the FAB and its overlay work as
  the primary (or only) log affordance on mobile too, replacing the
  separate stacked `.log` panel `mobile-responsive.md` currently
  describes?
- Accessibility: FAB needs a clear label/`aria-label` ("Open activity
  log"), keyboard operability (focus, Enter/Space to open, Escape to
  close), and focus management (does focus move into the overlay on open
  and return to the FAB on close)?

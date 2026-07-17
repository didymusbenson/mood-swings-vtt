# Feature: Preview / Log Panel Merge

> **Status:** Implemented (desktop). Mobile deferred — see Open questions.

## Implementation notes

Shipped as iteration 4 (the single-column view switch):

- `.board` drops from three columns to two — `minmax(0, 1fr) 300px` in
  `styles.css` — handing the old 264px left preview rail's width back to
  the battlefield.
- New `components/BoardSidebar.tsx` owns the right rail: a `Preview | Log`
  tab pair (`.sidebar__tabs`) over a body that renders **either** the
  `PreviewPane` (default) **or** the `ActivityLog` — never both. `GameBoard`
  now renders one `<BoardSidebar>` in place of the separate `<PreviewPane>`
  and `<ActivityLog>`.
- **Float pinning:** while a targeting flow or the discard inspector is open
  (`floating = !!pc.flow || discardOpen`), the tabs are hidden and the column
  is pinned to the Preview (which keeps its existing `preview--floating` lift
  above the scrim). Entering a flow resets the view to Preview and leaves it
  there afterward — Preview is the resting state, so a forced interruption
  doesn't snap back to a Log the player had wandered into.
- **Export** (`game/logExport.ts`, `formatLog`): the Log view gained a quiet
  Export button that downloads a round-grouped plain-text transcript
  (`mood-swings-log.txt`); score entries expand into their per-mood
  breakdown. Disabled when the log is empty.
- **Auto-scroll refinement:** the log jumps to newest on open, but on a new
  entry only follows if the reader is already near the bottom — so scrolling
  back through history isn't yanked away when the opponent acts mid-read.
- Verified end-to-end by driving the running app: two-column layout, tab
  swap, preview population, flow-pin (tabs hide + preview floats), and a
  real Export download with correct contents. `logExport` is unit-tested.

## Summary

Merge the two dedicated right-hand-side panels — the card **Preview**
(`PreviewPane.tsx`) and the **Activity Log** (`ActivityLog.tsx`) — into a
single shared column where the log currently lives. Today `GameBoard.tsx`
renders them as separate left/right panels in a three-column grid
(`.board { grid-template-columns: 264px minmax(0, 1fr) 300px; }` in
`styles.css`), and the log occupies a full permanent vertical slice of the
screen even though the game state it reflects is already visible on the
battlefield.

**Reframing (post-iteration-3):** the Activity Log is **not a first-class,
gameplay-necessary element**. Everything it shows is already observable
live on the board; its actual jobs are (1) diagnostic/export for later
review and (2) letting a player catch up if they lost track of something
earlier in the match. Neither job requires the log to be always-on or
always-visible. Given that, the design goal is simpler than earlier
iterations assumed: give the **Preview** its own full, dedicated,
undiminished real estate (nothing should letterbox the battlefield for
both things at once), and make the **Log** merely *available and usable*
on demand — it does not need simultaneous visibility with the preview,
ambient presence, or a permanent layout slot.

## Brief (captured)

- Right-hand column is **Preview by default**: `PreviewComponent` fills
  it at full detail (image, name, color, value, rarity, rules text, etc.
  — as today's `PreviewPane.tsx`), same as prior iterations.
- The **Log is not simultaneously visible with the Preview** — since it's
  a diagnostic/catch-up tool, not something needed moment-to-moment, it's
  acceptable for viewing it to temporarily replace the preview rather
  than compete with it for space. This is the key difference from
  iterations 1–3: there is no attempt to show both at once, no shrink, no
  cover-while-preserving-preview-underneath, no badge/notification
  system to maintain awareness of it.
- Simplest form (per the original "consolidate to one panel" framing):
  a single small **switch/button in the column** (e.g. a `Preview | Log`
  tab pair, or a lightweight "View Log" / "Back to Preview" toggle) swaps
  the column's content between the two. Whichever is active fills the
  full column; there's no partial/simultaneous state to manage.
  - Default state on entering/resuming a game: Preview.
  - The Log view should support what its actual jobs require: scrolling
    through history, and (per its diagnostic use case) some path to
    **export** the log — not just an in-app scroll view.
- Auto behavior during overlays: if the Log is the active column view
  when a card-play flow or other full-board overlay (e.g.
  `TargetOverlay`/`pc.flow`) needs the Preview (e.g. for live would-be
  values), the column should return to Preview — consistent with Preview
  being the column's real, permanent job and Log being a temporary detour
  from it.
- Net effect: one column, one clear default occupant (Preview, always
  full and undiminished when active), and a simple, low-mechanism way to
  step away to the Log and back — no drag gestures, no layering, no FAB,
  no persistent partial-visibility state to design or maintain.
- Mobile/narrow-viewport is explicitly **out of scope for this
  iteration** — to be addressed separately.

## Related

- `packages/app/src/components/GameBoard.tsx` — current three-column
  layout (`PreviewPane` left, `playfield` center, `ActivityLog` right);
  becomes a two-column layout (`playfield`, single right column) whose
  right column renders either `PreviewComponent` or `ActivityComponent`
  based on a simple local view-state (`'preview' | 'log'`), plus the
  small switch control itself.
- `packages/app/src/components/PreviewPane.tsx` — current preview
  rendering logic; unchanged in content/detail, just becomes the
  column's default view. Its `floating` mode (used during
  targeting/`TargetOverlay`) is the trigger for forcing the column back
  to Preview if the Log happened to be active.
- `packages/app/src/components/ActivityLog.tsx` / `packages/app/src/game/log.ts`
  — current log rendering and data; becomes the column's alternate view.
  Export functionality (per the diagnostic use case) is new — `log.ts`
  would need a serialization path (e.g. to JSON or plain text) that the
  Log view's export action calls.
- `packages/app/src/styles.css` — `.board` grid-template-columns (line
  ~782) simplifies to two columns instead of three; the right column's
  internal content swap needs no new grid/overlay rules, just conditional
  rendering within the existing ~300px slot.
- No existing tab/segmented-control component exists in
  `packages/app/src` today — this is the one small new UI primitive this
  iteration needs, notably simpler than the drag/overlay/FAB primitives
  earlier iterations required.
- `mobile-responsive.md` — explicitly deferred; the narrow-viewport
  single-column collapse (currently at `styles.css` line ~2407) is left
  as-is for now and revisited separately.

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can
bleed into other features.)_

### Things Claude wants to ask about

- Switch control shape: a two-tab pill (`Preview | Log`) always visible
  at the top of the column, or a single icon button that flips between
  "View Log" and "Back to Preview" labels/icons? Tabs make both
  destinations discoverable at a glance; a single flip-button is more
  compact.
- Does the switch/tab live inside the column (competing with the ~300px
  width for its own space) or as a small control just above/outside it?
- When the column auto-returns to Preview because a `TargetOverlay`/flow
  needs it while Log was active, does that feel abrupt to a player who
  was mid-read? Does it need any transition, or is instant-switch
  acceptable given the Log is explicitly non-critical to gameplay?
- After such an auto-return, does the column stay on Preview afterward,
  or does it snap back to Log once the flow ends (i.e., is "Log was
  active" state preserved across a forced interruption)?
- Export format/mechanism for the diagnostic use case — plain text,
  JSON, copy-to-clipboard, file download? Is this a button inside the Log
  view, or tied into a different existing affordance?
- Does switching to Log pause/freeze anything about the live game state,
  or is it purely a read-only view over `state.log` that updates live
  even while displayed (i.e., if the opponent acts while you're viewing
  Log, does it update in place)?
- Any persistence of which view (Preview/Log) is active — e.g. does
  switching to Log stay sticky across a re-render/turn change, or does it
  always reset to Preview at some natural boundary (new turn, new game)?
- Any change to the existing `CardDetailModal.tsx` (full-card modal)
  behavior, or does that remain a separate, unrelated affordance?
- Confirmed out of scope for this iteration: mobile/narrow-viewport
  behavior — revisit `mobile-responsive.md` separately once this design
  is settled for desktop.

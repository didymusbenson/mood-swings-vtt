# UI / Interaction Feedback

Running list of interface fixes and jank to address. The user adds items; each is
documented here as it comes in. Once the list is complete we turn it into a plan
and implement. Status legend: 🆕 new · 📋 planned · 🔧 in progress · ✅ done.

**Implementation plan (agent team) — ✅ shipped (merged to main, commit `c9cc772`):**
- **Agent A — engine (F1):** persistent per-player extra-play mechanism —
  one-time pending grants (Joy #125 self, Generosity #120 chosen opponent) applied
  at that player's next turn start, and recurring while-in-play grants
  (Hope #124 normal, Grace #121 discard) re-evaluated each of the
  owner's turn starts. Engine-only; +6 tests (75 total); effect-gaps.md updated.
- **Agent B — app (F2+F3+F4+F4a):** fixed seats + glow, unified battlefield
  (by-owner moods, deck+discard column w/ inspector, whole-field drop zone),
  modal targeting overlay (emoji avatars, discard fan), confirm slot above the
  hand (right). App-only; engine wiring + fixed-screen no-scroll preserved; +5 tests.

**Residuals (documented, not blocking):**
- **Grace #121 colour-match** on the recurring discard play is best-effort — the shared
  `discardPlaysRemaining` counter can't distinguish a Grace-sourced grant from Harmony's
  unconstrained one, so the "shares a colour with one of your moods" gate isn't enforced.
  Logged in `docs/effect-gaps.md`.
- **Mood rotation:** moods render **upright** (grouped by owner), not literally rotated 180°.
  Flag if you want true rotation.

| # | Status | Area | Item | Notes / open questions |
|---|--------|------|------|------------------------|
| F1 | ✅ | engine | "Play an additional mood on a future turn" cards don't grant the extra play | Fixed via `pendingExtraPlays`/`pendingDiscardPlays` + `extraPlaysAtTurnStart` hook, consulted at every turn start. #120/#121/#124/#125 (+#102 Stubbornness) wired. #135 remains 3+‑player, out of 2p MVP scope. |
| F2 | ✅ | layout | Fix P1 bottom / P2 top; glow the active player's zone instead of swapping seats | Fixed seats (P1 bottom / P2 top); active seat gets `.seat--turn` glow + "Your turn". Each plays from their own edge. |
| F3 | ✅ | layout | Replace stacked bands with a single readable "battlefield" (round state + scoring at a glance); whole battlefield is the drop zone; deck+discard column, discard click-to-inspect | Unified `.battlefield` grid; moods grouped by owner (upright), per-side scores, deck+discard column at left edge, discard opens a dimmed inspector modal; whole field is `data-drop="field"`. Preview (left) + Log (right) kept. |
| F4 | ✅ | targeting UX | Target selection must be an in-your-face **modal overlay** (dims background), not the current subtle inline flow | Dimming overlay, bold "Choose {target(s)}" header + count, played card held in Preview, per-kind pickers (avatars/moods/hand-fan/chips) brought forward. The modal owns its Submit/Skip/Cancel (part of the overlay); the non-modal manual "Play" uses the action slot above the hand. |
| F4a | ✅ | asset | **Player avatars** — **emoji placeholders** for now (real art TBD), auto-assigned per player | `assignAvatars` gives each seat a distinct emoji (🦊 P1 / 🐙 P2); shown in seat headers, topbar, and the F4 player picker. |
| F5 | ✅ | layout | Hands were still **inside** each player's battlefield box. Restructure into three stacked bands — TOP: opponent info + hand · MIDDLE: one battlefield (halves split by owner, no per-player boxes) · BOTTOM: your hand + info | Center column is now a `.playfield` 3-row grid: `PlayerEdge` (info + action slot + hand) top & bottom, a single `.battlefield` between them holding only the played moods split into `.bf__half--top`/`--bottom` (dashed centre split, no boxes), deck+discard column at the left edge. Active player's half + edge get a soft tint (no boxy ring). No page scroll at 1366×768 / 1440×900; targeting overlay + both play modes preserved. |
| F6 | ✅ | targeting UX | The **"selected" highlight in choice modals is too subtle** — hard to tell what's chosen (soft blue/green ring). Make it thicker and pop with a glowing red/yellow. | New `--select` amber-gold token drives one bold selection treatment across the modal: selected card targets get a 4px amber border + double glow ring + lift + a white **✓ corner badge**; selected chips get an amber border/glow (colour chips keep their colour border, add the glow); the selected avatar gets an amber border + glow + fill. `.target-fan` vertical padding widened so the lift/glow/badge aren't clipped by its scroll container. |
| F7 | ✅ | targeting UX | In a choice modal the **played-card preview is forced tiny and unreadable**; and **only hover** opened a hand preview. 1) make the preview readable during modals, and 2) let **tap/click/drag** (not just hover) force a preview. | The left **Preview** rail now lifts above the modal scrim (`.preview--floating`, amber border) so it stays fully visible and **updates live** as modal targets are hovered — a big, legible companion to the compact modal cards (opening a flow clears any stale hover-preview so it starts on the played card). Hand cards force the preview on **pointer-down**, so tap / click / drag are all instant preview triggers (hover stays the delayed 4th path); disabled opponent cards emit no pointer events, so no hidden card leaks. |
| F8 | ✅ | targeting UX | "Choose a player; **that player** gives/discards a card from **their** hand" cards showed the **acting player's own hand** by mistake (e.g. Compulsion as P1 → chose P2 → was shown P1's hand). | `handCard` slots gained a `handFrom` field; `'chosen'` makes `legalTargets` enumerate the hand(s) of the player(s) picked in an earlier `players` slot (union), so the chooser shows the correct hand. Marked #86 Compulsion, #67 Intimidation, #78 Suspicion; the UI passes the flow's chosen players into `legalTargets`. +5 engine regression tests; verified live (Compulsion→P2 now shows P2's hand). Still open: #60/#62 read from the **discard pile**, a different source `legalTargets` can't enumerate yet. In v2 the *targeted* player will make this choice on their own screen. |

---

## Design references (interaction inspiration)

For card fanning, confirmation buttons, and target/discard selection, draw on the
*interaction conventions* of **MTG Arena** and **Slay the Spire** — adapted to our
graph-paper aesthetic (borrow the feel, not their assets):
- **Hand fanning:** an arc that spreads/spaces out on hover so cards are readable;
  the hovered card lifts + enlarges above its neighbours.
- **Drag-to-play:** pick a card up and it follows the cursor; a clear "release here
  to play" affordance (the battlefield lights up as the drop zone).
- **Confirm button:** a single prominent, consistently-placed confirm/submit control.
  Ours: the modal targeting overlay owns its Submit/Cancel; the non-modal manual "Play"
  sits in the action slot above the hand.
- **Target / discard selection:** a dimmed modal overlay that isolates the choice;
  pile/discard selection presented as a horizontally scrollable **card fan** with
  selected targets highlighted (F4).
Applies to F2 (fan), F3 (battlefield drop zone), F4 (modal targeting/discard fan +
confirm placement).

---

## Details

### F1 — Future-turn "additional mood" grants are ignored  (✅ shipped)
**What:** Cards that let a player play an extra mood on a *later* turn/round don't
work — when that turn comes around the player still only gets one play.
**Where:** engine turn logic. The active player's play budget (`playsRemaining`)
is reset to 1 at the start of every turn (`resetTurn`), and grants
(`grantAdditionalMood` etc.) only affect the *current* turn — there is no
mechanism to carry a grant into a future turn. This is the documented
"start-of-turn / cross-turn extra play" gap.
**Affected cards:**
- **#125 Joy** — "you may play an additional mood on your next turn" (one-time, self).
- **#120 Generosity** — "an opponent may play an additional mood on their next turn" (one-time, chosen opponent).
- **#124 Hope** — "an additional mood during each of your turns" (recurring while in play).
- **#121 Grace** — "during each of your turns … an additional mood *from the discard pile* if it shares a color with one of your moods" (recurring; also needs the discard-play color-match constraint — separate sub-gap).
- **#135 Hurt Feelings** — 3+‑player only; **out of scope** for the 2‑player MVP.
**Fix approach (for the plan):** add a persistent, serializable per‑player
"pending / recurring extra plays" mechanism that `resetTurn` consults at the
start of each turn — one‑time grants (Joy, Generosity) consumed once; recurring
grants (Hope, Grace) driven by a while‑in‑play hook re-evaluated each turn start.
**Open question:** none blocking — semantics are clear from the card text.

### F2 — Fixed seats + glowing active zone (stop swapping seats)  (✅ shipped)
**What:** The hotseat currently swaps which player is at the bottom vs top based on
whose turn it is. The abrupt repositioning makes testing harder. Instead: keep
**Player 1 on the bottom, Player 2 on the top permanently**, and indicate whose
turn it is by making that player's **zone glow** — no seat swapping.
**Where:** `GameBoard.tsx` center bands + `styles.css`. Today the layout is
"active seat (bottom, big fanned hand) vs opponent (top, compact)"; it must become
fixed-position seats.
**Open question (blocking the plan):** on **P2's turn (top)**, where is the
interactive/drag-from hand?
- **(A) Symmetric seats** — P2's hand at the top becomes the interactive fanned
  hand (fans downward, drags toward center); P2's zone glows. Most literal read.
- **(B) Interactive hand always bottom-docked** — seats/labels stay fixed and the
  active zone glows, but the hand you drag from always docks at the bottom edge.
**Shipped (option A, symmetric):** fixed seats; the active player's hand is the focal
fan at their OWN edge (P2 fans down from the top, P1 up from the bottom); their zone
glows + "Your turn" badge. Later refined by F5 (hands moved into the edge bands).

### F3 — Unified "battlefield" center (readability)  (✅ shipped)
**What:** The stacked-bands center (opponent band / deck+drag band / you band) is
hard to read — you can't glance at the board and see the round's state. Replace it
with a single **battlefield** that represents the current round + scoring clearly.
**Keep:** the left **Preview** rail and right **Log** rail exactly where they are.
**Battlefield layout (from the sketch):**
- **Opponent hand** across the top; **your hand** along the bottom edge.
- Both players' **played moods** laid out in the central area (see open question on
  arrangement).
- **Deck** at the left edge, with the **discard pile directly below it**; the
  discard is **clickable to inspect** (open a viewer listing the discarded cards).
- **Score** shown prominently (per the sketch, at the right / on each player's side)
  so the round's scoring is legible at a glance.
- The **whole battlefield is the drop zone** — dropping a card anywhere in the play
  area plays it (to the active player's side); specific mood/player targets still
  work for targeted cards.
**Arrangement (RESOLVED):** moods are grouped **by owner** — "facing the player
who played it." Your moods sit on the bottom half near your hand; the opponent's on
the top half near theirs; each side shows its running score. This fixes seats and
means each player plays from their own edge ⇒ **F2 = option A**. Cards are rendered
**upright/readable** (grouped by owner spatially, *not* literally rotated 180°) to
serve the readability goal — flagged to the user to veto if they want true rotation.
**Shipped:** unified `.battlefield` grid — moods grouped by owner (upright), per-side
scores, deck+discard column at the left edge, discard opens a dimmed inspector modal;
the whole field is `data-drop="field"`. Preview (left) + Log (right) kept. F5 later
split it into three bands (opponent edge / battlefield / your edge).
**Sub-notes:** discard viewer = a click-to-open panel/modal listing discard-pile
cards (also useful for "play from discard" cards later).

### F4 — Modal targeting overlay (make selection unmissable)  (✅ shipped)
**What:** When a card forces target selection (moods in play, players, cards in the
discard, hand cards for a cost, etc.) players don't realize they must select
something — the current inline flow is too subtle. Replace it with a **modal
overlay** that dims/blocks the irrelevant background and demands the choice.
**Behavior:**
- The overlay **dims the battlefield** and irrelevant info behind it.
- The **card being played is held in the Preview space** (left rail) for reference
  while choosing.
- **Big bold header** at the top of the overlay: **"Choose {target(s)}"**, wording
  driven by what's needed (e.g. "Choose a mood", "Choose up to two players",
  "Choose a card from the discard").
- **Target-kind presentation, brought to the front of the overlay:**
  - **Players** → the **player avatars** (F4a) come forward to be clicked.
  - **Cards in play (moods)** → the valid target moods are brought to the front.
  - **Cards in discard** → the discard pile is shown as a **horizontally scrollable
    fan** on the overlay; selected targets are highlighted.
  - (Generalizes to hand-card / color / number slots too — each slot surfaces its
    valid options in the overlay; selected = highlighted.)
- **Cancel** (abort playing the card — e.g. no valid targets, or change of mind) and
  **Submit** (confirm the selection). Respect slot min/max (Submit enabled once min
  met; supports multi-select up to max).
**Button placement rule (applies project-wide):** the **Submit/confirm button must
NOT sit on top of the player's hand** (where it currently does). Every
submit/confirmation button needs a **dedicated home** on the interface that doesn't
collide with the rest of the UI. *Proposal:* modal Cancel/Submit at the
**bottom-center of the overlay**; non-modal confirms (manual "Play") use a reserved
**action slot** that never overlaps cards — pending Q2.
**Engine impact:** none — this is presentation only. The overlay assembles the same
`choices` object the engine already consumes (via `specFor`/`legalTargets`); the
per-card target **specs already exist** and drive which slots/targets the overlay
shows.
**Confirm-button home (RESOLVED):** all confirm/submit/Play buttons live in a
dedicated **action slot above the player's hand, off to the right** — never over
the cards. Applies to the modal Submit/Cancel and the non-modal manual "Play".
**Avatars (RESOLVED):** emoji placeholders per player for now (real art later).
**Shipped:** a dimming modal overlay with a bold "Choose {target(s)}" header + count,
the played card held in the Preview rail, and per-kind pickers brought forward
(avatars / mood tiles / hand-card fan / colour+number+choice chips). The modal owns its
Submit/Skip/Cancel controls (part of the overlay). Card glow means only "selected"
(blue); valid targets are shown by being in the overlay, not by a redundant highlight.

### F4a — Player avatars (new asset/component)  (✅ shipped)
**What:** Need player avatars — used by F4's player-target picker and generally to
identify seats. **Must be original** (no copyrighted art).
**Resolved:** use **emoji placeholders** per player as a stand-in (auto-assigned);
real avatar art to be decided later. Avatars appear in the seat headers and come
forward in F4's player-target picker.
**Shipped:** `assignAvatars` gives each seat a distinct emoji (🦊 P1 / 🐙 P2), shown in
the seat headers, the topbar score tags, and the F4 player picker. Real avatar art is
still TBD (a deliberate future item, not a gap).

### F5 — Hands out of the battlefield boxes; three stacked bands  (✅ shipped)
**What:** Hands were still rendered *inside* each player's battlefield container. Pull
them out into three horizontal bands — **TOP:** opponent info + hand · **MIDDLE:** one
battlefield (halves split by owner, no per-player boxes) · **BOTTOM:** your hand + info.
**Shipped:** the center column is a `.playfield` 3-row grid — `PlayerEdge` (info +
action slot + hand) at top & bottom, a single `.battlefield` between them holding only
the played moods, split into `.bf__half--top`/`--bottom` by a dashed centre line (no
boxes), with the deck+discard column at the left edge. The active player's half + edge
get a soft tint; turn is also shown by the "Your turn" badge. No page scroll at
1366×768 / 1440×900; targeting overlay + both play modes preserved.

### Card back (asset)  (✅ shipped)
**What:** Use the **official** printed card back (you provided the mtg.wiki URL) rather
than the CSS homage. **Shipped:** `CardBack` hotlinks the official back from mtg.wiki
(never committed — same IP policy as the card fronts) and falls back to the CSS/SVG
homage if the image can't load (offline / blocked CDN). The real image is verifiable in
a normal browser; the in-sandbox proxy blocks image CDNs, so previews there show the
fallback.

### F6 — Choice-modal selection highlight must pop  (✅ shipped)
**What:** The "selected" affordance in choice modals was too subtle — a soft blue/green
ring left players unsure whether a card/chip/avatar was actually chosen. Make it thicker
and unmistakable; a glowing red or yellow.
**Shipped:** one shared amber-gold selection token (`--select` / `--select-glow` /
`--select-soft`) drives every selected state in the modal so "chosen" reads the same way
everywhere:
- **Card targets** (`.card--target-selected`): 4px amber border, a double glow ring
  (`0 0 0 4px` solid + soft halo + 20px outer glow), a small upward lift, and a white
  **✓ badge** pinned to the top-right corner.
- **Chips** (`.chip.is-on`): amber border + soft fill + glow + bold amber label; **colour
  chips keep their colour border** (identity) and add the same glow, so they pop too.
- **Avatar picker** (`.avatar-pick.is-on`): amber border + soft fill + glow + nudge.
- `.target-fan` gained generous vertical padding so a selected card's lift, glow and
  corner tick sit inside the scrollport instead of being clipped by `overflow-x: auto`.

### F7 — Readable preview during modals; tap/click/drag to preview  (✅ shipped)
**What:** Two related previewer gaps.
1. In a choice modal the played-card preview was crammed into the modal rail and became
   too small to read. Either enlarge it or float the Preview rail on top of the overlay
   so it stays visible and live.
2. The requirement that a hand card can be **tapped/clicked/dragged** to force a preview
   was unmet — only hover opened one.
**Shipped:**
- The left **Preview** rail now lifts above the modal scrim while a targeting flow (or the
  discard inspector) is open (`.preview--floating`: `z-index` above the scrim, amber
  border + drop shadow). It shows the card being played at full, legible size and
  **updates live** as modal targets are hovered — a big companion to the necessarily
  compact modal cards. Opening a flow clears any stale hover-preview so the pane starts on
  the played card, then follows hovered targets.
- Hand cards force the preview on **pointer-down**, which begins every tap, click and
  drag — so all three are now instant preview triggers, with hover remaining the delayed
  4th path. Disabled opponent-hand cards emit no pointer events, so no hidden card leaks
  through the new trigger. (Drag already surfaced the dragged card via `previewTarget`;
  this makes tap/click match.)

### F8 — "That player" hand chooser showed the wrong hand  (✅ shipped)
**What:** Cards worded "choose a player; **that player** gives/discards a card from
**their** hand" drove the chooser off the **acting** player's hand instead of the chosen
player's. Reported for **Compulsion** (#86): played as Player 1, chose Player 2, then was
shown **Player 1's** own hand to "give" to Player 2.
**Cause:** `legalTargets`' `handCard` case always enumerated `state.hands[actingPlayer]`.
The card *effects* were already correct (they read the target's hand), so a mismatched UI
pick was silently ignored — the effect fell back to the target's first card.
**Shipped:** `ChoiceSlot` gained a `handFrom?: 'acting' | 'chosen'` field. `'chosen'`
makes `legalTargets` enumerate the **union of the hands of the players picked in an
earlier `players` slot** of the same flow (single-target cards resolve to one hand;
multi-target to the union). The app threads the flow's chosen players into `legalTargets`
via a new `SlotContext`. Marked `handFrom: 'chosen'` on **#86 Compulsion**, **#67
Intimidation** (an opponent's hand) and **#78 Suspicion** (each targeted player's own
hand). +5 engine regression tests in `specs.test.ts`; verified end-to-end in the app
(Compulsion → Player 2 now shows Player 2's five-card hand).
**Still open (documented):** #60 Corruption / #62 Cynicism read `choices.cards` from the
**discard pile** — a source `legalTargets` can't enumerate yet, so those still show the
acting hand. And per the reporter, in **v2** the *targeted* player will make this choice
on their own screen, which will reshape this whole interaction.

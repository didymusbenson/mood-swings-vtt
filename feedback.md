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
| F8 | ✅ | targeting UX | "Choose a player; **that player** gives/discards a card from **their** hand" cards showed the **acting player's own hand** by mistake (e.g. Compulsion as P1 → chose P2 → was shown P1's hand). | `handCard` slots gained a source field (`cardsFrom`); `'chosen'` makes `legalTargets` enumerate the hand(s) of the player(s) picked in an earlier `players` slot (union), so the chooser shows the correct hand. Marked #86 Compulsion, #67 Intimidation, #78 Suspicion; the UI passes the flow's chosen players into `legalTargets`. +5 engine regression tests; verified live (Compulsion→P2 now shows P2's hand). |
| F10 | ✅ | rules fidelity | "After playing this mood — choose a mood" cards (like **Conviction**) couldn't choose **themselves**, but by the rules the mood is *in play* when its effect resolves, so it should be a legal self-target. The chooser omitted it (it showed "No valid moods" when nothing else was out). | The mood is played into play *before* `afterPlaying` runs, so a self-target is valid engine-side. Added a `SELF_TARGET` sentinel + `ChoiceSlot.selfTargetable`; the flow offers the played mood as a candidate and the engine resolves the sentinel to its real uid before the effect runs. Marked #6 Conviction, #12 Faith, #24 Scorn, #66 Hate (single-target "choose a/any mood", `from:'any'`). "Another mood"/opponent-only/cost slots are correctly excluded. +2 engine tests; verified live (Conviction → chooses itself → bottom-decked + draw). |
| F9 | ✅ | engine/targeting | Sweep of remaining known targeting gaps so the engine isn't left incomplete. Discard-recovery cards (#60 Corruption, #62 Cynicism, #128 Nostalgia) showed the acting **hand** instead of the **discard pile** → those abilities silently did nothing. Parity cards (#28 Anxiety odd, #76 Spite even) and the total-cap card (#80 Anger ≤[5]) over-offered moods → the player's pick was silently overridden or no-op'd. | Generalised the source field to `cardsFrom: 'acting' \| 'chosen' \| 'discard'` and marked the three discard cards. Added `MoodFilter.valueParity` (odd/even → #28/#76 offer only legal moods) and `MoodFilter.maxTotalValue` (#80: the flow blocks a pick that would push the running total past [5]). Fixed stale comments (Doubt #36 "not enforceable" — it *is*, via `bannedColors`; Anger "[3]"→"[5]"). +6 engine regression tests; `effect-gaps.md` updated. Remaining residual: Grace #121's recurring discard-play colour gate (grant-accounting, not targeting). |
| F12 | ✅ | preview UX | The **hover-to-preview had a ~1s delay** on mouse — waiting felt unintuitive and frustrating. | Removed the delay: `hoverPreview` now calls `setPreview` immediately for mouse too (touch/pen were already instant). Verified live (preview populates ~150ms after hover, vs the old 1000ms). |
| F11 | ✅ | layout | Your (Player 1) hand was small and hard to read. Make it bigger and pull it to the bottom so name + value + art read clearly; its bottom (rules text) **may clip off the screen edge** — the Preview covers the text. Moods in play must **not** shrink or clip. | Your bottom hand cards are enlarged (134×188) and pinned to the very bottom, showing only their top slice — the rest bleeds off the table edge (MTG-Arena / Slay-the-Spire). Per the follow-up, your **info bar + action slot were pulled OUT of the vertical stack into the foreground** (bottom-left / bottom-right corners) — that fourth stacked row was the crowding. The battlefield reclaimed their ~67px (282→424px), so **full-size mood tiles now clip 0px** (previously the old layout already clipped moods ~36px on your turn). Opponent (hotseat) focal hand stays moderate + fully visible. No page scroll at 1366×768 / 1440×900. |

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
**Follow-up:** the discard-pile source these called out is now handled — see F9. And per
the reporter, in **v2** the *targeted* player will make this choice on their own screen,
which will reshape this whole interaction.

### F9 — Sweep the remaining known targeting gaps  (✅ shipped)
**What:** After F8, close out the rest of the "wrong pile / over-offered targets" family
so the engine isn't left incomplete.
**Broken abilities (showed the acting hand instead of the discard pile → silently did
nothing):**
- **#60 Corruption** ("recover up to two discard cards"), **#62 Cynicism** ("move a
  discard card into an opponent's hand"), **#128 Nostalgia** ("take a discard card").
  Their effects read `choices.cards` from `state.discard`; the UI offered the acting
  hand, so a pick never matched and the ability no-op'd.
**Over-offered mood pickers (player's pick silently overridden by the effect):**
- **#28 Anxiety** (odd-value moods only) and **#76 Spite** (even-value only) offered
  every mood; the effect re-filtered by parity and moved a *different* mood.
- **#80 Anger** ("total value [5] or less") let you build a selection exceeding the cap,
  which the effect then rejected wholesale — a confusing silent no-op.
**Shipped:**
- Generalised the source field to **`cardsFrom: 'acting' | 'chosen' | 'discard'`**;
  `'discard'` enumerates the shared discard pile. Marked #60/#62/#128.
- Added **`MoodFilter.valueParity`** (`'odd'`/`'even'`) so #28/#76 offer only legal moods.
- Added **`MoodFilter.maxTotalValue`**; the flow blocks a mood pick that would push the
  running total past the cap (#80), so an illegal selection can't be assembled. The
  effect keeps its defensive re-check.
- Cleaned stale comments: Doubt #36 was labelled "not enforceable" but *is* enforced via
  `pendingBannedColors`/`bannedColors`; Anger's "[3]" corrected to "[5]".
- +6 engine regression tests (`specs.test.ts`); `docs/effect-gaps.md` updated with the
  targeting-source model.
**Residual (documented):** Grace #121's *recurring* discard-play colour-match is
best-effort — the shared `discardPlaysRemaining` counter can't tell a Grace-sourced
(colour-gated) discard play from Harmony's unconstrained one. That's grant-accounting,
not targeting.

### F10 — "After playing" mood effects can target the mood itself  (✅ shipped)
**What:** Cards like **Conviction** ("After playing this mood — Choose a mood. Its player
puts it on the bottom of the deck and draws a card") are, by the rules, *in play* the
moment they're played, so their own effect should be able to choose them. The chooser
never offered the played mood — with nothing else out it showed "No valid moods" and
couldn't be submitted.
**Cause:** the UI runs target selection *before* dispatching the play, so the mood has no
uid yet and can't be listed — even though the engine plays the mood into play *before*
`afterPlaying` runs, making a self-target perfectly valid once resolved.
**Shipped:**
- A `SELF_TARGET` sentinel + `ChoiceSlot.selfTargetable`. For a marked afterPlaying mood
  slot the flow offers the **played mood** as an extra candidate (shown as "This mood");
  the choice records the sentinel, and `playMood` swaps it for the mood's real uid the
  instant it enters play, just before the effect runs — so existing `byUid` effect code
  works unchanged.
- Marked the unambiguous single-target "choose a/any mood" afterPlaying cards:
  **#6 Conviction, #12 Faith, #24 Scorn, #66 Hate** (`from:'any'`, no "other" clause).
  Cards worded "another/other mood", opponent-only targets, and cost slots (the mood
  isn't in play during a cost) are correctly left non-self-targetable.
- +2 engine tests; verified live end-to-end (Conviction chooses itself → bottom-decked,
  Player 1 draws, per the activity log).
**Follow-up (also shipped):** the multi-player "each chosen player loses one of their
moods" cards — **#7 Courage, #28 Anxiety, #76 Spite, #101 Shock** — are now self-inclusive
too. The played mood is offered when the acting player is one of the chosen players and the
mood passes the slot's value filter (checked via `playedMoodQualifies` on its would-be
value): **Shock** ([2] ≤ [3]) can discard itself outright; Courage/Anxiety/Spite qualify
only when their value is buffed to [5]+/odd/even. **Courage** also gained a mood slot so you
can choose *which* [5]+ mood each player loses (its effect already read `choices.moods`,
auto-picking otherwise). Verified live: playing Shock, choosing yourself, and picking "This
mood" discards Shock into the pile. +5 engine tests.

### F11 — Bigger, bottom-anchored hand; foreground info bar  (✅ shipped)
**What:** Your hand was small and hard to read. Enlarge it and pull it to the very bottom so
name + value + art carry each card; the card's bottom (rules text) may run off the screen
edge — the Preview shows the full text. Moods in play must NOT shrink or clip.
**Design (from the reference images — MTG Arena / Slay the Spire):** big hand cards anchored
to the bottom, their lower portion clipped by the screen edge; the player's info + controls
float in the foreground at the bottom corners rather than stacking as rows.
**Root cause of the crowding (the user's own diagnosis):** the bottom edge stacked *four*
things vertically — info bar, action slot, hand — each stealing height from the battlefield,
which forced the moods to clip. First attempt (shrinking the mood tiles to fit) was wrong —
moods must keep their size.
**Shipped:**
- Your bottom hand cards are enlarged to 134×188 but only their top `--tile-hand-visible`
  (116px) sits in the layout; the taller card renders full-height and overflows below the
  table edge (viewport-clipped), so name + value + art read big.
- The bottom seat's **info bar (`.seat__head`) and action slot (`.actionslot`) are floated
  in the foreground** — absolute, bottom-left / bottom-right corners — instead of stacking.
  Removing those ~67px from the vertical stack grew the battlefield **282 → 424px**, so
  full-size mood tiles (184px) now clip **0px** (the old layout already clipped them ~36px on
  your turn — this is strictly better).
- The opponent's focal (hotseat) hand stays moderate and fully visible; only your bottom
  hand gets the oversized bottom-clipped treatment. Table bottom padding removed so the clip
  lands at the screen edge.
- Verified live at 1366×768 and 1440×900 (no page scroll), with an empty board, a populated
  board (mood not clipped), and the opponent's turn.
**Note:** at the bottom corners the floated info bar / Pass button lightly overlap the hand's
outermost cards (Slay-the-Spire-style); the info bar has a paper backing so it stays legible.

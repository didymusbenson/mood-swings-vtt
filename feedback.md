# UI / Interaction Feedback

Running list of interface fixes and jank to address. The user adds items; each is
documented here as it comes in. Once the list is complete we turn it into a plan
and implement. Status legend: 🆕 new · 📋 planned · 🔧 in progress · ✅ done.

| # | Status | Area | Item | Notes / open questions |
|---|--------|------|------|------------------------|
| F1 | 🆕 | engine | "Play an additional mood on a future turn" cards don't grant the extra play | Known gap: `playsRemaining` resets to 1 each turn with no cross-turn carry. Affects #120, #121, #124, #125 (#135 is 3+‑player, out of 2p MVP scope). |
| F2 | 📋 | layout | Fix P1 bottom / P2 top; glow the active player's zone instead of swapping seats | **Resolved: option A** (fixed seats, each plays from their own edge) — implied by F3. |
| F3 | 📋 | layout | Replace stacked bands with a single readable "battlefield" (round state + scoring at a glance); whole battlefield is the drop zone; deck+discard column, discard click-to-inspect | Keep Preview (left) + Log (right). **Arrangement resolved:** moods grouped by owner ("facing the player who played it") — yours bottom, oppo top. Rendering upright for readability (confirm if you want literal 180° rotation). |
| F4 | 🆕 | targeting UX | Target selection must be an in-your-face **modal overlay** (dims background), not the current subtle inline flow | ❓ Open: avatar style + names picked vs auto (Q1); confirm-button home (Q2). Depends on **new: player avatars**. |
| F4a | 🆕 | asset | **Player avatars** (new) — needed for the targeting overlay's player picker (and generally) | ❓ Open: style (initial badge / sketch faces / user art) + pick-on-start vs auto. |

---

## Details

### F1 — Future-turn "additional mood" grants are ignored  (🆕)
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

### F2 — Fixed seats + glowing active zone (stop swapping seats)  (🆕)
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
**Plan:** _pending answer to the open question._

### F3 — Unified "battlefield" center (readability)  (🆕)
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
**Plan:** _to be written in the planning pass (F2 + F3 implement together)._
**Sub-notes:** discard viewer = a click-to-open panel/modal listing discard-pile
cards (also useful for "play from discard" cards later).

### F4 — Modal targeting overlay (make selection unmissable)  (🆕)
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
**Open questions:** Q1 avatars (style + pick-vs-auto) · Q2 confirm-button home.
**Plan:** _pending Q1/Q2._

### F4a — Player avatars (new asset/component)  (🆕)
**What:** Need player avatars — used by F4's player-target picker and generally to
identify seats. **Must be original** (no copyrighted art).
**Open question:** style — (a) initial/colour badge, (b) small set of hand-drawn
sketch-face avatars matching the aesthetic (auto-assigned), (c) user-provided art;
and whether name/avatar is chosen on the start screen or auto-assigned P1/P2.
**Plan:** _pending Q1._

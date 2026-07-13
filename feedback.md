# UI / Interaction Feedback

Running list of interface fixes and jank to address. The user adds items; each is
documented here as it comes in. Once the list is complete we turn it into a plan
and implement. Status legend: 🆕 new · 📋 planned · 🔧 in progress · ✅ done.

| # | Status | Area | Item | Notes / open questions |
|---|--------|------|------|------------------------|
| F1 | 🆕 | engine | "Play an additional mood on a future turn" cards don't grant the extra play | Known gap: `playsRemaining` resets to 1 each turn with no cross-turn carry. Affects #120, #121, #124, #125 (#135 is 3+‑player, out of 2p MVP scope). |
| F2 | 🆕 | layout | Stop swapping player seats each turn; fix P1 bottom / P2 top and glow the active player's zone instead | ❓ Open: A vs B — likely resolved to **A** by F3 (fixed seats, play from your own edge). Confirm. |
| F3 | 🆕 | layout | Replace stacked bands with a single readable "battlefield" (round state + scoring at a glance); whole battlefield is the drop zone | Keep Preview (left) + Log (right) rails. ❓ Open: split moods by owner (top=oppo / bottom=you) vs single shared pool — see F3 details. |

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
**Open question (blocking the plan):** mood arrangement —
- **(Split by owner, recommended):** opponent moods in the top half (near their
  hand), yours in the bottom half (near your hand), each side showing its running
  score. Implies fixed seats + play-from-your-own-edge ⇒ **resolves F2 as option A**.
- **(Single shared pool):** all moods intermixed in one grid.
**Plan:** _pending answers (arrangement + F2 A/B)._
**Sub-notes:** discard viewer = a click-to-open panel/modal listing discard-pile
cards (also useful for "play from discard" cards later).

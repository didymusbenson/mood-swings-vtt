# Mood Swings v2 — Multiplayer Implementation

**Status:** shipped to the `claude/v2-deployment-strategy-iorlce` branch and deployed to
the live GitHub Pages site. **Scope delivered:** Goldfish (solo, both hands) and Host
Game (real two-player hidden-hand multiplayer over WebRTC). **Deferred by request:**
Vs Computer (the seat abstraction is scaffolded; no AI brain yet).

Design reference: [`docs/v2-multiplayer-spec.md`](docs/v2-multiplayer-spec.md).

---

## What was built

### One engine, three seat configurations
The whole feature rests on a single idea: the rules engine never changed. It stays a
pure `reduce(state, action) → state`, and everything new is a thin layer *around* it:

- **`packages/engine/src/redact.ts`** — `redactFor(state, viewer)`: projects the one
  authoritative state down to what a seat may see (own hand kept; opponent hands blanked
  to same-length `HIDDEN`; deck order stripped; RNG seed zeroed; staged colour-ban
  dropped; per-line-private log entries rewritten). Pure + JSON-safe.
- **`packages/app/src/net/agent.ts`** — `PlayerAgent` (a seat's action source + view
  sink): `LocalHumanAgent`, `RemoteHumanAgent` (networked), `ComputerAgent` (deferred stub).
- **`packages/app/src/net/matchRunner.ts`** — owns the engine and is the *sole* caller of
  `engine.apply`; broadcasts a per-seat (optionally redacted) view after each action.
- **`packages/app/src/net/session.ts`** — `GoldfishSession`, `HostSession`, `JoinSession`
  behind one `Session` interface that `<App>` talks to.
- **`packages/app/src/net/peer.ts`** — PeerJS transport, room codes, message protocol,
  inbound-action + `Choices` serialization guards.
- **`packages/app/src/net/delegation.ts`** — opponent-choice orchestration (below).

| Mode | Seats | Engine location | Redaction |
| --- | --- | --- | --- |
| **Goldfish** | LocalHuman + LocalHuman | this browser | off (one driver sees all) |
| **Host Game (host)** | LocalHuman(p1) + RemoteHuman(p2) | host browser | on |
| **Host Game (joiner)** | thin client, no engine | host browser | receives redacted views |

### Networking (Host Game)
Host-authoritative WebRTC over PeerJS's public broker. The host clicks **Host Game**,
configures the deck, and gets a **6-character room code**. The opponent clicks **Join
Game**, enters the code, and is dealt in. A `#room=CODE` deep link prefills the join
screen. The host owns the engine and re-validates every action the joiner sends, so a
spoofed or out-of-turn action is rejected. Hands stay hidden: the joiner only ever
receives a view redacted for their seat.

### Opponent-choice delegation
Six cards contain a sub-choice that belongs to the *other* player (picking from a hidden
hand, or every player choosing simultaneously). For these, the host collects the
sub-choice(s) from the right seat(s) **before** applying, then merges them into the one
`Choices` object the engine already expects — no engine rules change.

| # | Card | Who chooses the delegated slot | Simultaneous |
| --- | --- | --- | --- |
| 67 | Intimidation | the chosen opponent reveals a card to give | no |
| 86 | Compulsion | the chosen opponent gives a card | no |
| 68 | Malice | the chosen player picks two of their moods | no |
| 78 | Suspicion | each chosen player discards one | **yes** |
| 29 | Avoidance | each player passes one of their moods | **yes** |
| 31 | Confusion | each player passes one of their hand cards | **yes** |

For the three simultaneous cards the host withholds `engine.apply` until *all* responses
are in, so no player can see another's pick before making their own.

### Engine fix bundled in
**Confusion #31** previously honoured only the *active* player's card choice and forced
every other player to pass their first card. It now reads a pooled `choices.cards` so
each player passes their own chosen card (mirrors Suspicion #78). Backward-compatible
with hotseat; covered by a new engine test.

---

## ⚠️ One ruling I made for you to confirm — #67 Intimidation

The spec flagged Intimidation as the one card whose "who chooses?" is ambiguous. I ruled
that **the chosen opponent picks which card to reveal and give**, because:

- the card text (`docs/card-notes.md:724`) says *"that player reveals a card from their
  hand"* — the opponent is the actor, and there's no "you choose" clause; and
- in hidden-hand multiplayer the active player can't see the opponent's hand to pick from
  it, so any other reading would require exposing that hidden hand.

If you intended the **active player** to choose instead (looking at the opponent's hand),
tell me and I'll switch it — it's a one-line change (remove `67` from `DELEGATED_CARDS`)
plus a decision about revealing the hand. Everything else needs no ruling.

---

## Deployment

- The Pages workflow (`.github/workflows/deploy-pages.yml`) now deploys on push to
  `claude/v2-deployment-strategy-iorlce`. The live site is
  **https://didymusbenson.github.io/mood-swings-vtt/**.
- `main` no longer auto-deploys. To make `main` authoritative again later, add `main`
  back to the workflow's `branches:` list (or merge this branch into `main`).
- **One-time check (only you can do this):** GitHub → **Settings → Pages → Source:
  "GitHub Actions"**, and confirm the `github-pages` environment has no protection rule
  that restricts deploys to `main`. If a deploy is queued but never publishes, this is why.
- WebRTC needs a secure context — satisfied by the Pages HTTPS URL.

---

## Validation checklist

**Automated (all green in CI / locally):**
- [x] `redactFor` unit tests — opponent hands → `HIDDEN` (right length), deck order gone
  (length kept), `seed === 0`, staged colour-ban dropped, private log lines rewritten,
  public fields byte-identical, source never mutated, JSON round-trips, `Mood.data`
  allowlist guard.
- [x] Delegation unit tests — chooser sets per card, `cardsFrom:'chosen'` scoping,
  response merging, per-chooser caps.
- [x] Confusion #31 pooled-cards engine test.
- [x] Full suites: **132 engine + 92 app tests**, typecheck + build clean.
- [x] Headless-browser smoke: Goldfish plays a turn; Host reaches the room code; Join
  connects; `#room=` deep link prefills.

**Manual — verify on the live site with a friend (needs two real devices/tabs + network):**
- [ ] Host creates a game, shares the code; joiner enters it and the board appears for both.
- [ ] Joiner's DevTools: `state.hands[opponent]` is all `-1` (HIDDEN), `state.deck` is all
  `-1`, `state.seed === 0` — **no hidden info crosses the wire**.
- [ ] Opponent's hand renders as face-down card backs; your own hand is face-up.
- [ ] You can only act on your own turn; the pass/play controls are inert on the opponent's turn.
- [ ] Each seat sits at the **bottom** of its own screen (viewer-relative orientation).
- [ ] Round-boundary cinematics and the activity log animate on the joiner too.
- [ ] A full game plays to a 3-round winner without desync.
- [ ] Disconnect handling: closing one tab shows the other a clear "connection lost →
  back to menu" (no silent hang).

---

## Cards to run acceptance tests against (real two-player games)

These are chosen to stress hidden info, delegated choice, simultaneity, reveal plumbing,
and cross-seat card movement. Play each in a live Host/Join game and confirm the noted
behavior:

- **#67 Intimidation** — the *opponent* is prompted to reveal a card from their hand; it
  lands in your hand and you may play it. Confirm you never see their full hand, and the
  ruling above feels right in play.
- **#86 Compulsion** — the *opponent* picks which card to give you (their hidden hand is
  never shown to you).
- **#78 Suspicion** — choose both players; **each** is prompted simultaneously to discard
  one of their own cards; confirm neither pick is revealed before both are in.
- **#31 Confusion** — pick a direction; **each** player is prompted to pass one of their
  own hand cards; confirm each player's *own* chosen card moves (the #31 fix).
- **#29 Avoidance** — pick a direction; **each** player is prompted to pass one of their
  own moods (public moods, delegated agency).
- **#68 Malice** — the chosen player is prompted to pick which two of *their* moods.
- **#33 Curiosity** (and/or **#71 Paranoia**) — the engine reveals a random hidden card;
  confirm that reveal reaches **both** players in the log while the rest of the hand stays
  hidden.
- **#62 Cynicism** — moves a public discard card into the opponent's hidden hand; confirm
  it becomes face-down in the opponent's view afterward.
- **#49 Rationalization** — rotates whole hands between seats; confirm each seat's
  post-rotation hand is correct locally and hidden to the other.
- **#36 Doubt** — stages next round's colour ban; confirm the opponent's view never shows
  the staged ban until it activates.
- **A full "waiting for opponent" round** — play any delegated card and confirm the
  active player sees a "Waiting for your opponent to choose…" indicator, and the delegated
  player sees the picker.

---

## Known limitations (deliberate — "functional and polished, not perfect")

- **No reconnection.** A dropped WebRTC connection ends the match; both sides route back to
  the menu. One host, one joiner, one game.
- **PeerJS public broker.** Room codes rely on the free `0.peerjs.com` broker to introduce
  the two browsers (only for the initial handshake — gameplay is peer-to-peer after that).
  It's best-effort with no SLA; a failed connect shows an error and you retry with a new
  code. Swappable if you ever want a self-hosted broker.
- **Host is the authority.** The host's browser holds the game state; if the host closes
  the tab, the game ends. Fine for casual play among friends.
- **Vs Computer is deferred.** The `ComputerAgent` seat exists and consumes the same
  redacted view a remote human would (so a future AI is fair by construction), but it has
  no brain and there is no menu button for it yet.

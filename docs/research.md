# Multiplayer Research — True Two-Human Play with Session Codes

> Status: **Research / decision doc.** Targets the v2 requirement in
> [`../REQUIREMENTS.md`](../REQUIREMENTS.md) §1: "two clients connect; opponent's
> hand shown as **card backs** (hidden info)." This document evaluates how to get
> there while the app is hosted on **static GitHub Pages**, and recommends a
> concrete, incremental path specific to this codebase.

## TL;DR (executive summary)

1. GitHub Pages is **static-only** — no backend we host, no WebSocket server we
   own. So real-time play must be **peer-to-peer (WebRTC)** or ride a
   **third-party hosted realtime service**. Both keep our hosting free/static.
2. **Recommended: [Trystero](https://github.com/dmotz/trystero)** — WebRTC where
   the signaling runs over public infrastructure (Nostr/MQTT/BitTorrent). Room
   codes are first-class (the room ID *is* the session code), zero server, zero
   accounts, ships from Pages today.
3. Architecture fit is excellent: our engine is already a **pure reducer**
   (`Engine.apply(state, action) => state`) over a **fully serializable
   `GameState`** with a **deterministic seeded RNG** (`rng.ts`, mulberry32). That
   makes a **host-authoritative action-relay** model the clean, low-risk design.
4. Recommend **action-relay** (guest sends `Action`s, host runs the authority and
   broadcasts a **redacted** `GameState`) over full-state-sync or lockstep. It is
   the least code, naturally hides the opponent's hand, and reuses the engine
   verbatim on the host.
5. **Fallback / stopgap:** a **local bot** to goldfish against is trivial here —
   it's just an `Action`-picker over the existing engine and legal moves, shippable
   on pure static hosting immediately with no networking at all. It is a stopgap,
   not the goal.

---

## 1. The core constraint: static hosting

GitHub Pages serves pre-built files (our `packages/app/dist`) over HTTPS/CDN. It
**cannot**:

- run server code (no Node, no request handlers),
- hold open a WebSocket **we** host,
- keep authoritative game state server-side.

Everything dynamic must therefore run **in the two browsers**, or on a **service
someone else operates**. Two families of solution:

- **(a) Peer-to-peer (WebRTC):** the two browsers open a direct, encrypted data
  channel and exchange game messages with no server in the data path.
- **(b) Hosted realtime / BaaS:** a managed service (Firebase, Supabase, Ably,
  Pusher, PartyKit/Cloudflare) relays messages. We write no backend; we consume an
  SDK and a free tier.

### 1.1 The signaling problem (why "P2P" still needs *something*)

WebRTC connects two peers directly, but they cannot find each other unaided. To
establish a connection each peer must exchange:

- an **SDP offer/answer** (media/data-channel capabilities), and
- **ICE candidates** (their reachable IP\:port pairs, discovered via STUN).

This handshake needs a **signaling channel** — some pre-existing way to pass a few
small messages between the two browsers *before* the direct channel exists. Nothing
in WebRTC provides it; you bring your own. On static hosting you can't host that
channel, so "serverless P2P" really means **"use someone else's public channel for
signaling only."** Trystero's trick is exactly this: it does the offer/ICE exchange
over public networks (Nostr relays, MQTT brokers, BitTorrent trackers) keyed by the
room code, then drops to direct WebRTC for the actual game traffic.

Two more WebRTC realities to plan for:

- **STUN** (public, e.g. Google's `stun.l.google.com:19302`) is enough for most
  home NATs to discover a routable address. It's free and stateless.
- **Symmetric NAT / strict firewalls** (~5–15% of pairs, often corporate or some
  mobile carriers) can't be traversed by STUN alone and need a **TURN relay**
  (which *does* cost money/infra because it proxies media). For a 2-player casual
  card game we can accept the small failure rate initially and add TURN later if
  needed.

---

## 2. Options evaluated

### 2.A Serverless P2P (WebRTC)

#### Trystero — **recommended**
- **What:** a tiny JS lib. `joinRoom(config, roomId)` → you get `makeAction()`
  channels and peer join/leave events. Signaling runs over a pluggable public
  "strategy": **Nostr** (default), **MQTT**, **BitTorrent**, **IPFS**, or hosted
  **Supabase/Firebase**. Data between peers is **end-to-end encrypted**.
- **Session codes:** first-class and free — **the room ID *is* the code.** We
  generate a short human-shareable code (e.g. `MOOD-7F3K`) and both players type it.
  No accounts, no lobby server.
- **Cost / infra:** **zero.** No signup, nothing to deploy, ships straight from
  Pages.
- **Reliability:** direct WebRTC is fast and solid once connected. The soft spots
  are (1) **public signaling relays** can be flaky/rate-limited — mitigate by
  configuring a couple of strategies/relays; (2) community reports note Trystero
  struggles with **many** simultaneous peers in one room — irrelevant for us (2
  peers); (3) symmetric-NAT pairs still need TURN.
- **Verdict:** best fit. Room codes + zero server + E2E encryption + minimal code.

#### PeerJS
- **What:** WebRTC wrapper with a **free public broker** (PeerServer Cloud) doing
  signaling; you can self-host the broker later. Each peer has an **ID**; you
  `peer.connect(otherId)`.
- **Session codes:** the **peer ID** is the code — but you must coordinate who is
  "host" (whose ID gets shared) and IDs can collide/expire on the public cloud.
  Workable but slightly clunkier than Trystero's symmetric room model.
- **Cost / infra:** free public broker (best-effort, rate-limited, occasional
  downtime); optional self-host crosses the infra line.
- **Reliability:** fine peer-to-peer; the **public cloud broker is a single
  dependency** with no SLA. ~5–10 connections max per peer (we need 1).
- **Verdict:** solid fallback if Trystero's signaling proves flaky; slightly more
  wiring for codes.

#### Plain WebRTC + public STUN + a signaling shim
- **What:** use the browser `RTCPeerConnection` directly, public STUN for
  candidates, and hand-roll a signaling shim (copy/paste the SDP blob, a QR code,
  or a tiny paste-bin). 
- **Session codes:** you'd invent them; manual SDP copy/paste is ugly UX.
- **Cost / infra:** zero if you accept manual signaling; otherwise you're back to
  hosting something.
- **Verdict:** most control, most code, worst UX. Only worth it to avoid a
  dependency. Trystero essentially *is* this, done well — don't rebuild it.

### 2.B Hosted realtime / BaaS (managed, we host nothing)

The session code maps to a **room doc / channel name**; both clients subscribe to
that channel and exchange actions/state through the service. No P2P, so **no NAT
problems** — connections "just work" — at the cost of a third-party dependency,
possibly an account/API key baked into the static build, and free-tier ceilings.

| Service | "Session code" = | Free tier (approx, verify current) | Notes |
|---|---|---|---|
| **Firebase Realtime DB / Firestore** | a room document / path | Generous daily read/write + connection caps (Spark plan) | Easiest "shared JSON that syncs"; great fit for host-authoritative `GameState`. API key is public by design; lock down with security rules. |
| **Supabase Realtime** | a channel name / row | Free project, no hard op limit advertised; broadcast + Postgres changes | Open-source, Postgres-backed; channel broadcast is a clean action bus. |
| **Ably** | a channel name | ~6M msgs/mo, 200 concurrent connections | Purpose-built realtime, very reliable; overkill but painless. |
| **Pusher Channels** | a channel name | Sandbox: 200 concurrent conns, 200K msgs/day, 100 channels | Simplest pub/sub API; daily-capped. |
| **PartyKit / Cloudflare Durable Objects** | a **room** (one Durable Object per room) | Durable Objects now on the **Workers Free plan** | Each room is a stateful WS server at the edge — could even run the **authoritative engine server-side**. Most powerful; requires a Cloudflare deploy (a little infra, but not *ours* to keep alive). |

**Trade-off vs P2P:** BaaS removes NAT/firewall fragility and gives you a
persistent room (reconnect, spectators) for free, but adds an external dependency,
a free-tier ceiling, and usually a public API key shipped in the static bundle.

### 2.C Minimal self-hosted relay — **crosses the "no infra" line**

A ~50-line WebSocket relay (Node `ws`, or Bun) on a **Fly.io / Render / Railway**
free tier: clients connect by room code, the server fans out messages (or runs the
authority). Simplest possible custom backend and gives full control (incl. TURN if
you add coturn). **But** it means a service to deploy, keep awake (free tiers
sleep/idle), and monitor — explicitly the "dedicated server infrastructure" the
product owner wanted to avoid. Keep this in the back pocket only if both P2P and
BaaS are rejected.

---

## 3. Architecture fit — why this engine makes it easy

The engine is already shaped for networked multiplayer. From the code:

- **Pure reducer.** `Engine.apply(prevState, action)` does
  `structuredClone(prevState)` then returns the next state — no hidden globals, no
  in-place surprises (`packages/engine/src/engine.ts`). Same inputs → same output.
- **Serializable state.** `GameState` (`types.ts`) is plain data: arrays of card
  numbers (`deck`, `discard`), `hands: Record<PlayerId, CardNumber[]>`,
  `moods: Record<PlayerId, Mood[]>`, scalar `phase/round/activePlayer`, a numeric
  `seed`, and a `log`. It is directly `JSON.stringify`-able and
  `structuredClone`-able → trivial to send over a data channel.
- **Tiny action type.** `Action = { type:'play'; player; card; choices? } |
  { type:'pass'; player }`. A player's entire intent is a few bytes — perfect for
  an action-relay.
- **Deterministic RNG.** `rng.ts` is seeded mulberry32 and the `seed` lives *in*
  `GameState`; every shuffle/draw advances and stores it. So two machines starting
  from the same `seed` and applying the same `Action` sequence reach byte-identical
  states — this is what unlocks lockstep if we ever want it.

### 3.1 Recommended model: **host-authoritative action-relay**

One peer is the **host** (authority); the other is the **guest**. Roles are decided
at join (e.g. room creator = host).

```
GUEST                             HOST (runs Engine)                 GUEST view
  |-- intent: Action ------------>|
  |                               | validate against legal moves
  |                               | state = engine.apply(state, action)
  |                               | redacted = redact(state, forGuest)
  |<---- redacted GameState ------|-------------------------------->  render
```

- **Host** owns the single source of truth, runs `Engine.apply`, and is the only
  place the engine executes. Guest never needs the engine to *decide* anything —
  only to *render*.
- **Guest** sends its `Action` (its `play`/`pass`) up; receives a redacted
  `GameState` down and renders it. Optimistic local prediction is optional and not
  needed for a turn-based card game.
- **Cheating:** because only the host runs the authority and redacts, the guest
  literally never receives the host's hidden hand — hidden info is enforced by
  *not sending it*, not by client-side hiding.

### 3.2 Redaction (satisfies the v2 "card backs" requirement)

Add a pure helper next to the engine (new file, e.g.
`packages/engine/src/redact.ts`, or in the app's `game/` layer) that takes
`(state, viewerId)` and returns a `GameState` where **the opponent's `hands[oppId]`
is replaced by its length** (render N card backs). Everything else — moods in play,
deck/discard counts, scores, `log` — is already public per the rules. Because hands
are `Record<PlayerId, CardNumber[]>`, redaction is a one-liner: keep the viewer's
array, swap the opponent's for `Array(len).fill(FACEDOWN)` or a `{count}` field the
UI understands.

### 3.3 Action-relay vs. full-state-sync vs. lockstep

- **Action-relay (recommended):** send only `Action`s up, redacted `GameState`
  down. Smallest messages, single authority, natural hidden-info. Host and guest
  need not run the same engine build. **Pick this.**
- **Full-state-sync:** host just broadcasts the whole (redacted) `GameState` after
  each change; guest replaces its state wholesale. Even simpler to reason about and
  fine given our small state; slightly more bytes per message. A perfectly good
  *first* implementation — effectively action-relay where the "up" channel is still
  actions and the "down" channel is full snapshots (which is what 3.1 already
  draws).
- **Lockstep (determinism-enabled, optional):** both peers run the engine; they
  exchange only `Action`s and each applies them to stay in sync, trusting the
  seeded RNG for identical results. No authority needed and minimal bandwidth, but
  it requires **identical engine builds on both peers** and careful handling of
  hidden info (you can't ship the opponent their secret draws), so it's more work
  to get right than host-authoritative. Our determinism makes it *possible*; we
  don't need it for v2.

---

## 4. Fallback: local bots to goldfish against (stopgap)

If true P2P stalls (signaling flakiness, NAT, time), we can still deliver
single-player practice **immediately, on pure static hosting, with zero
networking**:

- The engine already exposes everything a bot needs: current `GameState`, the
  `Action` shape, and the rules for what's legal (active player, `playsRemaining`,
  cards in hand). A bot is just a function
  `pickAction(state, botId): Action` that enumerates legal plays
  (`state.hands[botId]` → a `play` per holdable card, plus `pass`) and chooses one.
- **Difficulty ladder, all trivial:**
  - *Random legal:* pick any legal `Action`. ~20 lines.
  - *Greedy:* for each candidate, `engine.apply(clone, action)` and score the
    resulting board via the existing value/scoring queries (`queries.ts`); keep the
    best. Still tiny because `apply` is pure — you can simulate freely.
  - *1-ply lookahead:* same, but also simulate the opponent's best reply. Optional.
- Ships as a local "vs Computer" mode reusing the exact hotseat UI, swapping the
  second player's input for `pickAction`. No server, no dependency, no risk.

Frame it as a **stopgap** that de-risks the schedule and gives something playable
now — the real goal remains true two-human play.

---

## 5. Recommendation & decision table

**Recommendation:** ship in three steps.

1. **Now (unblocks play, zero infra):** local **bot** mode (§4) — reuse the engine
   + UI, add an `Action`-picker. Immediately playable on Pages.
2. **v2 target (true multiplayer, zero server):** **Trystero** room codes +
   **host-authoritative action-relay** (§3.1) with **redaction** for card backs
   (§3.2). Room ID = shared session code. Add a `net/` layer in `packages/app`; the
   engine stays untouched except a small pure `redact` helper.
3. **Only if P2P proves too fragile in the wild:** fall back to a **BaaS channel**
   (Firebase or Supabase) as the transport — same host-authoritative design, just a
   relayed channel instead of a WebRTC data channel — or add a **TURN** server for
   the symmetric-NAT minority. A self-hosted relay is the last resort (crosses the
   no-infra line).

| Option | Server we run? | Cost | Effort | Robustness (2-player) | Room codes natural? |
|---|---|---|---|---|---|
| **Local bot (stopgap)** | No | $0 | **Very low** | N/A (offline) | N/A |
| **Trystero (P2P)** ⭐ | No | $0 | Low | Good; public-signaling + symmetric-NAT are the risks | **Yes — room ID is the code** |
| PeerJS (P2P) | No (public broker) | $0 | Low–med | Good peer link; broker has no SLA | Via peer ID (needs host/guest coordination) |
| Plain WebRTC + STUN + shim | No | $0 | High | Good once connected; awful signaling UX | You invent them |
| Firebase / Supabase (BaaS) | No (managed) | $0 free tier | Medium | High; no NAT issues | Yes — room doc / channel |
| Ably / Pusher (BaaS) | No (managed) | $0 free tier (capped) | Medium | High | Yes — channel name |
| PartyKit / CF Durable Objects | Deploy, not maintain a box | $0 free tier | Medium–high | High; can host the authority at edge | Yes — one room = one Durable Object |
| Self-hosted WS relay | **Yes** | ~$0 free tier (idles) | Medium | Full control incl. TURN | Yes — but crosses no-infra line |

⭐ = recommended for the v2 true-multiplayer milestone.

---

## Sources

- [Trystero (GitHub)](https://github.com/dmotz/trystero) and
  [trystero.dev docs](https://trystero.dev/docs/)
- [PeerJS](https://peerjs.com/) and [PeerJS FAQ](https://peerjs.com/client/faq)
- [PartyKit docs](https://docs.partykit.io/how-partykit-works/) /
  [Durable Objects on the Workers Free plan](https://developers.cloudflare.com/changelog/post/2025-04-07-durable-objects-free-tier/)
- [Ably: Firebase vs Supabase Realtime](https://ably.com/compare/firebase-vs-supabase),
  [Pusher vs Supabase](https://ably.com/compare/pusher-vs-supabase)
- WebRTC signaling / STUN / TURN background: MDN WebRTC guides.
- This codebase: `packages/engine/src/engine.ts` (`Engine.apply`, `Action`),
  `packages/engine/src/types.ts` (`GameState`), `packages/engine/src/rng.ts`
  (seeded mulberry32), `packages/engine/src/queries.ts` (scoring queries).

# Feature: V2 — Networked Multiplayer

> **Status:** Stub — brief captured, not yet refined.
>
> Baseline intent is already described in `REQUIREMENTS.md` (§1 Goal, §5
> Architecture); this doc collects it as a feature and is where V2 refinement
> happens. The engine is now stable enough to start building V2 "for real."

## Summary

Move from local hotseat (v1) to real networked two-player play: two clients
connect, the server owns authoritative game state, and each client receives a
**redacted** view so an opponent's hidden information stays hidden.

## Brief (captured, from REQUIREMENTS)

- **Two clients connect**; opponent's hand is shown as **card backs** (hidden
  info) rather than face-up.
- **Server-authoritative state.** A Node + WebSocket server owns the
  authoritative engine; clients send actions and receive redacted views
  (opponent hand → backs / counts).
- **Shared engine.** The same TypeScript engine module runs client and server
  (reused verbatim from v1).
- **Rooms + reconnect.**

## Open questions / to refine

_(To be filled during refinement — answers may arrive via chat and can bleed
into other features.)_

### Save / resume across refresh (parked exploration)

Because V2 is server-authoritative with room/session IDs, a browser refresh can
**reconnect to the room and rehydrate from the server** rather than losing the
game — i.e. save/resume is largely a side effect of doing reconnect right. Worth
exploring, **not** high priority. (Contrast v1 hotseat, where a refresh has no
server to rehydrate from and would lose the in-progress game.)

### Things Claude wants to ask about

- Transport/hosting assumptions (where the server runs; LAN vs. internet;
  matchmaking vs. share-a-room-code).
- Room lifecycle: create/join flow, reconnect window, what happens if a player
  drops.
- How V2 relates to the alternate formats in `pregame-configuration.md` —
  especially Duel (two decks, per-card ownership) and the 4-player Team formats
  (which fundamentally need networking + hidden info).
- Redaction rules: exactly which state is hidden per viewer (hand contents vs.
  counts, face-down piles, drafted cards, etc.).

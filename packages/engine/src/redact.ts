// Per-viewer state projection for hidden-information multiplayer (v2 Host Game).
//
// The engine holds ONE authoritative, fully-public GameState. Before a state is
// shown to (or sent to) a given seat, `redactFor(state, viewer)` strips everything
// that seat is not entitled to see: other players' hand contents, the draw-pile
// order, the RNG seed (which predicts all future draws), staged-but-not-yet-active
// secrets, and per-line-private log entries. Everything else in GameState is public
// board / flow state and passes through untouched.
//
// This is pure and framework-agnostic (no React) so it can be unit-tested and run
// identically on the host before broadcasting a view over the wire.

import type { CardNumber, GameState, LogEntry, PlayerId } from './types.js';

/**
 * Placeholder card number for a concealed hand/deck card. Array *length* (hand
 * size, deck size) is preserved so the UI can render the right number of face-down
 * cards; the identity is gone. -1 is never a real card number (cards are 1..135).
 */
export const HIDDEN = -1 as CardNumber;

/** True for a concealed card slot produced by redaction. */
export function isHidden(card: CardNumber): boolean {
  return card === HIDDEN;
}

/**
 * Project `state` down to what `viewer` may legitimately see. Returns a deep clone;
 * the input is never mutated. The result is JSON-safe (same as GameState) so it can
 * be sent over a WebRTC DataChannel with JSON.stringify.
 */
export function redactFor(state: GameState, viewer: PlayerId): GameState {
  const s = structuredClone(state);

  // Hands: keep the viewer's own hand verbatim; for every other seat, blank cards to
  // HIDDEN — EXCEPT cards that have been publicly revealed (Curiosity #33), which stay
  // face-up while they remain in that hand. Hand SIZE is always preserved.
  for (const pid of Object.keys(s.hands) as PlayerId[]) {
    if (pid === viewer) continue;
    s.hands[pid] = redactHand(state.hands[pid] ?? [], state.revealed?.[pid] ?? []);
  }

  // Draw pile: order is secret from everyone. Keep only the length.
  s.deck = state.deck.map(() => HIDDEN);

  // RNG seed: critical — it deterministically predicts every future draw and
  // shuffle. A viewer must never receive it. Zero it out.
  s.seed = 0;

  // Doubt #36 stages next round's colour ban; it is not yet active and must stay
  // secret from the opponent until it takes effect at the round boundary.
  s.pendingBannedColors = [];

  // Log: honour the per-line concealment contract (LogEntry.private / redacted).
  s.log = state.log.map((e) => redactLine(e, viewer));

  // Everything else — moods, discard, roundScores, bannedColors, activePlayer,
  // phase, players, round, turnOrder, playsRemaining, discardPlaysRemaining,
  // conditionalGrants, pending*Plays, playedThisTurn, actedThisRound,
  // discardedThisRound, firstPlayer, winner, uidCounter — is public board / flow
  // state and passes through untouched.
  return s;
}

/**
 * Blank a hand to HIDDEN for a viewer who doesn't hold it, keeping up to the revealed
 * multiplicity of each card number face-up (reconciled against the live hand, so a
 * revealed card that has since been played simply isn't there to show). Positions are
 * preserved; only identities are concealed.
 */
function redactHand(hand: CardNumber[], revealed: CardNumber[]): CardNumber[] {
  if (revealed.length === 0) return hand.map(() => HIDDEN);
  const budget = new Map<CardNumber, number>();
  for (const c of revealed) budget.set(c, (budget.get(c) ?? 0) + 1);
  return hand.map((card) => {
    const left = budget.get(card) ?? 0;
    if (left > 0) {
      budget.set(card, left - 1);
      return card; // still revealed → face-up
    }
    return HIDDEN;
  });
}

/**
 * A log line marked `private` to some OTHER player is rewritten to its public
 * `redacted` text (or blanked) for this viewer, and the private/redacted markers
 * are dropped so nothing downstream can recover the hidden text.
 */
function redactLine(e: LogEntry, viewer: PlayerId): LogEntry {
  if (e.private && e.private !== viewer) {
    return { ...e, message: e.redacted ?? '', private: undefined, redacted: undefined };
  }
  return e;
}

/**
 * Keys allowed to appear in `Mood.data` (per-instance card scratch space). Redaction
 * passes moods through untouched because everything a mood exposes today is public.
 * If a future card ever stashes HIDDEN information in `Mood.data`, this allowlist —
 * enforced by a unit test — will fail, forcing a decision about scrubbing it in
 * `redactFor` rather than silently leaking it over the wire.
 */
export const PUBLIC_MOOD_DATA_KEYS: readonly string[] = ['playedRound'];

// Board queries shared by value computation and effect resolution.

import type { Color, GameState, Mood, PlayerId } from './types.js';
import { type CardDB, effectsFor } from './cards/registry.js';

export function allMoods(state: GameState): Mood[] {
  return state.players.flatMap((p) => state.moods[p.id] ?? []);
}

/**
 * Which discard-pile cards the player can currently start a `from: 'discard'` play
 * with — the UI's source of truth for offering discard plays. Mirrors the engine's
 * `consumeDiscardPlay` legality:
 *   - a dedicated discard-play grant (`discardPlaysRemaining` — Grief/Angst/Harmony);
 *   - a Melancholy #69 permission (any mood exposing `permitsPlayFromDiscard`) plus a
 *     normal play to spend; or
 *   - a discard-sourced colour-matched grant (Grace #121).
 * Banned colours (Doubt #36) are excluded either way. The engine still validates on
 * dispatch — this only decides what to OFFER.
 */
export function legalDiscardPlays(state: GameState, player: PlayerId, db: CardDB): number[] {
  const hasDiscardGrant = state.discardPlaysRemaining > 0;
  const permitsMelancholy = (state.moods[player] ?? []).some(
    (m) => effectsFor(resolveCardNumber(m)).permitsPlayFromDiscard != null,
  );
  const hasNormalPlay = canPlayFromHand(state, player);
  const discardColorGrants = state.conditionalGrants.filter(
    (g) => g.from === 'discard' && g.constraint.kind === 'colorSharedWithControllerMoods',
  );
  const sharesControllerColor = (color: Color) =>
    (state.moods[player] ?? []).some((m) => colorOf(m, db) === color);

  return state.discard.filter((n) => {
    const data = db.get(n);
    if (state.bannedColors.includes(data.color)) return false; // Doubt #36
    if (hasDiscardGrant) return true;
    if (permitsMelancholy && hasNormalPlay) return true;
    return discardColorGrants.length > 0 && sharesControllerColor(data.color); // Grace #121
  });
}

/** True if the player can start any discard-sourced play right now. */
export function canPlayFromDiscard(state: GameState, player: PlayerId, db: CardDB): boolean {
  return legalDiscardPlays(state, player, db).length > 0;
}

/**
 * True if the player can spend a play on a HAND card right now — either the base
 * unconditional play (`playsRemaining`) or a hand-sourced conditional grant. A
 * player whose only remaining budget is discard-only (Grief/Angst/Harmony grants,
 * Grace's `from: 'discard'` grant) returns false here, so the UI can dim the hand
 * and name the source. Coarse (colour-agnostic): a specific constrained hand grant
 * may still be rejected per-card at dispatch — the engine remains the authority.
 */
export function canPlayFromHand(state: GameState, player: PlayerId): boolean {
  return (
    state.playsRemaining > 0 ||
    state.conditionalGrants.some((g) => (g.from ?? 'hand') === 'hand')
  );
}

export function resolveCardNumber(mood: Mood): number {
  return mood.copyOf ?? mood.card;
}

/**
 * A mood's current in-play colour. Honours an active colour override
 * (Imagination #42) if one has been applied to the mood; otherwise falls back to
 * the printed colour of the card (resolving `copyOf`). Cards not in play keep
 * their printed colour, so this must only be used for moods in play.
 */
export function colorOf(mood: Mood, db: CardDB): Color {
  return mood.colorOverride ?? db.get(resolveCardNumber(mood)).color;
}

/** Printed value for a mood, honouring secondary-value rotation and copying. */
export function printedValue(mood: Mood, db: CardDB): number {
  const data = db.get(resolveCardNumber(mood));
  if (mood.usingSecondary && data.secondaryValue) return data.secondaryValue.value;
  return data.value;
}

export function countColor(state: GameState, db: CardDB, color: Color): number {
  return allMoods(state).filter((m) => colorOf(m, db) === color).length;
}

export function mostCommonColors(state: GameState, db: CardDB): Color[] {
  const counts = new Map<Color, number>();
  for (const m of allMoods(state)) {
    const c = colorOf(m, db);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let max = 0;
  for (const n of counts.values()) max = Math.max(max, n);
  if (max === 0) return [];
  return [...counts.entries()].filter(([, n]) => n === max).map(([c]) => c);
}

export function moodiest(state: GameState): PlayerId[] {
  let max = 0;
  for (const p of state.players) max = Math.max(max, (state.moods[p.id] ?? []).length);
  return state.players.filter((p) => (state.moods[p.id] ?? []).length === max).map((p) => p.id);
}

export function findMood(state: GameState, uid: string): Mood | undefined {
  return allMoods(state).find((m) => m.uid === uid);
}

export function ownerOf(state: GameState, uid: string): PlayerId | undefined {
  for (const p of state.players) {
    if ((state.moods[p.id] ?? []).some((m) => m.uid === uid)) return p.id;
  }
  return undefined;
}

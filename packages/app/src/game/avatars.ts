// Emoji player-avatar placeholders (F4a). Real avatar art is TBD; for now each
// seat gets a distinct emoji, auto-assigned by seat order so the same game
// always shows the same faces. Used in the seat headers and as the clickable
// avatars in the F4 targeting overlay's player picker.

import type { PlayerState } from '@mood-swings/engine';

/** Distinct, original emoji stand-ins (no copyrighted art). */
export const AVATAR_POOL = ['🦊', '🐙', '🦉', '🐢', '🐝', '🦄', '🐳', '🐰'] as const;

/**
 * Deterministically assign a distinct emoji to every player by seat order.
 * If (improbably) there are more players than pool entries the pool wraps, so
 * assignment never throws — collisions only past `AVATAR_POOL.length` players.
 */
export function assignAvatars(players: Pick<PlayerState, 'id'>[]): Record<string, string> {
  const map: Record<string, string> = {};
  players.forEach((p, i) => {
    map[p.id] = AVATAR_POOL[i % AVATAR_POOL.length]!;
  });
  return map;
}

/** The emoji for one player id within a roster (falls back to the first face). */
export function avatarFor(players: Pick<PlayerState, 'id'>[], id: string): string {
  const idx = players.findIndex((p) => p.id === id);
  return AVATAR_POOL[(idx < 0 ? 0 : idx) % AVATAR_POOL.length]!;
}

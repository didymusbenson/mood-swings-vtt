// Pure, immutable deck-count model for the deckbuilder.
//
// The builder's single source of truth is a `Map<number, count>` keyed by
// collector number (see docs/features/deckbuilder-overhaul.md — "Deck-list
// panel"). Every mutator here returns a NEW Map rather than mutating in place so
// React state updates stay referentially honest and the model composes cleanly
// with undo/history and dirty-tracking.

import type { CardDB, Color, Rarity } from '@mood-swings/engine';

/** cardNumber -> copies. Invariant: every stored count is an integer >= 1. */
export type DeckCounts = Map<number, number>;

type RarityKey = 'common' | 'uncommon' | 'rare' | 'mythic';

/** Add one copy of card `n`, returning a new map. */
export function addCopy(d: DeckCounts, n: number): DeckCounts {
  const next = new Map(d);
  next.set(n, (next.get(n) ?? 0) + 1);
  return next;
}

/**
 * Subtract one copy of card `n`, returning a new map. Removing the last copy
 * deletes the key entirely (subtracting from an absent card is a no-op copy).
 */
export function subCopy(d: DeckCounts, n: number): DeckCounts {
  const next = new Map(d);
  const current = next.get(n);
  if (current === undefined) return next;
  if (current <= 1) next.delete(n);
  else next.set(n, current - 1);
  return next;
}

/**
 * Set the exact copy count for card `n`. `count <= 0` deletes the key; a
 * non-finite `count` (NaN/Infinity from a bad quantity box) is ignored. Finite
 * fractional inputs are floored to an integer copy count.
 */
export function setCount(d: DeckCounts, n: number, count: number): DeckCounts {
  if (!Number.isFinite(count)) return d;
  const next = new Map(d);
  const floored = Math.floor(count);
  if (floored <= 0) next.delete(n);
  else next.set(n, floored);
  return next;
}

/** Total number of cards in the deck (sum of copies). */
export function totalCards(d: DeckCounts): number {
  let total = 0;
  for (const count of d.values()) total += count;
  return total;
}

/**
 * Flatten to the engine's `number[]` (repeats = copies), ascending by collector
 * number. This is the shape `StartConfig.deck` expects.
 */
export function flatten(d: DeckCounts): number[] {
  const out: number[] = [];
  for (const n of [...d.keys()].sort((a, b) => a - b)) {
    const count = d.get(n) ?? 0;
    for (let i = 0; i < count; i++) out.push(n);
  }
  return out;
}

/** Build a count map from a flat `number[]` (repeats become copies). */
export function fromFlat(deck: number[]): DeckCounts {
  const out: DeckCounts = new Map();
  for (const n of deck) out.set(n, (out.get(n) ?? 0) + 1);
  return out;
}

/** Copies grouped by rarity (over the four playable rarities). */
export function rarityBreakdown(d: DeckCounts, db: CardDB): Record<RarityKey, number> {
  const out: Record<RarityKey, number> = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
  for (const [n, count] of d) {
    if (!db.has(n)) continue;
    const rarity = db.get(n).rarity as Rarity;
    if (rarity === 'common' || rarity === 'uncommon' || rarity === 'rare' || rarity === 'mythic') {
      out[rarity] += count;
    }
  }
  return out;
}

/** Copies grouped by printed color (only colors present appear as keys). */
export function colorBreakdown(d: DeckCounts, db: CardDB): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [n, count] of d) {
    if (!db.has(n)) continue;
    const color = db.get(n).color as Color;
    out[color] = (out[color] ?? 0) + count;
  }
  return out;
}

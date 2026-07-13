// Deck construction: the "random" box-collation generator and custom-deck
// validation. See docs/RULES.md "The deck".

import type { CardData, Rarity } from './types.js';
import { shuffle } from './rng.js';
import type { CardDB } from './cards/registry.js';

export type PlayableRarity = 'common' | 'uncommon' | 'rare' | 'mythic';

/** A retail box: 45 cards = 23 common / 14 uncommon / 6 rare / 2 mythic. */
export const BOX_COLLATION: Record<PlayableRarity, number> = {
  common: 23,
  uncommon: 14,
  rare: 6,
  mythic: 2,
};

export const CUSTOM_MIN_FOR_TWO_PLAYERS = 15;

/** Minimum deck size: 15 for two players, +15 per extra player. */
export function minDeckSize(players: number): number {
  return CUSTOM_MIN_FOR_TWO_PLAYERS * (players - 1);
}

/**
 * Generate a random box-collation deck: for each rarity, pick N distinct cards
 * (no duplicates, matching the retail box mix). Returns card numbers.
 */
export function randomBoxDeck(db: CardDB, seed: number): { deck: number[]; seed: number } {
  const byRarity = groupByRarity(db.all());
  const deck: number[] = [];
  let s = seed;
  for (const rarity of ['common', 'uncommon', 'rare', 'mythic'] as PlayableRarity[]) {
    const pool = byRarity[rarity] ?? [];
    const need = BOX_COLLATION[rarity];
    if (pool.length < need) {
      throw new Error(`Not enough ${rarity} cards (${pool.length}) for box collation (need ${need})`);
    }
    const s2 = shuffle(pool, s);
    s = s2.seed;
    deck.push(...s2.items.slice(0, need).map((c) => c.number));
  }
  return { deck, seed: s };
}

export interface DeckValidation {
  ok: boolean;
  size: number;
  errors: string[];
}

/**
 * Validate a custom deck for a given player count. Enforces the minimum size.
 * Duplicates are allowed (off by default in the builder UI) so they are not an
 * error here, but we surface them as info via `errors` only when they break a
 * rule — currently none, so duplicates pass.
 */
export function validateCustomDeck(deck: number[], players = 2): DeckValidation {
  const errors: string[] = [];
  const min = minDeckSize(players);
  if (deck.length < min) errors.push(`Deck has ${deck.length} cards; minimum is ${min} for ${players} players.`);
  return { ok: errors.length === 0, size: deck.length, errors };
}

function groupByRarity(cards: CardData[]): Partial<Record<Rarity, CardData[]>> {
  const out: Partial<Record<Rarity, CardData[]>> = {};
  for (const c of cards) (out[c.rarity] ??= []).push(c);
  return out;
}

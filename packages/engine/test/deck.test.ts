import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCardDB, type RawCard } from '../src/data.js';
import {
  randomBoxDeck,
  validateCustomDeck,
  minDeckSize,
  standardDeckNotice,
  BOX_COLLATION,
  type PlayableRarity,
} from '../src/deck.js';

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const raw = JSON.parse(readFileSync(path, 'utf8')) as RawCard[];
const db = loadCardDB(raw);

describe('random box collation', () => {
  it('produces 45 distinct cards with the retail rarity mix', () => {
    const { deck } = randomBoxDeck(db, 42);
    expect(deck.length).toBe(45);
    expect(new Set(deck).size).toBe(45); // no duplicates
    const counts = { common: 0, uncommon: 0, rare: 0, mythic: 0 } as Record<string, number>;
    for (const n of deck) counts[db.get(n).rarity] = (counts[db.get(n).rarity] ?? 0) + 1;
    expect(counts).toEqual(BOX_COLLATION);
  });

  it('never includes the special #134/#135 printings', () => {
    for (let seed = 0; seed < 25; seed++) {
      const { deck } = randomBoxDeck(db, seed * 7 + 1);
      expect(deck).not.toContain(134);
      expect(deck).not.toContain(135);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(randomBoxDeck(db, 7).deck).toEqual(randomBoxDeck(db, 7).deck);
  });
});

describe('custom deck validation', () => {
  it('requires 15 cards for two players, 30 for three', () => {
    expect(minDeckSize(2)).toBe(15);
    expect(minDeckSize(3)).toBe(30);
    expect(validateCustomDeck([1, 2, 3], 2).ok).toBe(false);
    expect(validateCustomDeck(Array.from({ length: 15 }, (_, i) => i + 1), 2).ok).toBe(true);
  });

  it('includes an empty warnings array', () => {
    expect(validateCustomDeck([1, 2, 3], 2).warnings).toEqual([]);
    expect(validateCustomDeck(Array.from({ length: 15 }, (_, i) => i + 1), 2).warnings).toEqual([]);
  });
});

/** Build a deck with an exact rarity mix by picking distinct cards from the db. */
function deckWithMix(mix: Record<PlayableRarity, number>): number[] {
  const deck: number[] = [];
  for (const rarity of Object.keys(mix) as PlayableRarity[]) {
    const pool = db.all().filter((c) => c.rarity === rarity);
    if (pool.length < mix[rarity]) throw new Error(`not enough ${rarity} cards`);
    deck.push(...pool.slice(0, mix[rarity]).map((c) => c.number));
  }
  return deck;
}

describe('standardDeckNotice', () => {
  it('returns null for the standard 45-card / 23-14-6-2 build', () => {
    const deck = deckWithMix(BOX_COLLATION);
    expect(deck.length).toBe(45);
    expect(standardDeckNotice(deck, db)).toBeNull();
  });

  it('returns a reminder mentioning the deck size for a 16-card deck', () => {
    const deck = deckWithMix({ common: 8, uncommon: 5, rare: 2, mythic: 1 });
    expect(deck.length).toBe(16);
    const notice = standardDeckNotice(deck, db);
    expect(notice).not.toBeNull();
    expect(notice).toContain('16');
    expect(notice).toContain('45');
    // Calm and informational: never flags duplicates.
    expect(notice!.toLowerCase()).not.toContain('duplicate');
  });

  it('returns a reminder for a 45-card deck with an off-mix rarity distribution', () => {
    const deck = deckWithMix({ common: 24, uncommon: 13, rare: 6, mythic: 2 });
    expect(deck.length).toBe(45);
    expect(standardDeckNotice(deck, db)).not.toBeNull();
  });
});

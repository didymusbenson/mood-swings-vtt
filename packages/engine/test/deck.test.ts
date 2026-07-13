import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadCardDB, type RawCard } from '../src/data.js';
import { randomBoxDeck, validateCustomDeck, minDeckSize, BOX_COLLATION } from '../src/deck.js';

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
});

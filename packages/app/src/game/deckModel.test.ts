import { describe, expect, it } from 'vitest';
import { db } from './db.js';
import {
  addCopy,
  colorBreakdown,
  flatten,
  fromFlat,
  rarityBreakdown,
  setCount,
  subCopy,
  totalCards,
  type DeckCounts,
} from './deckModel.js';

// A few real, unambiguous pool cards for breakdown assertions.
const ALTRUISM = 1; // white, rare
const CHARITY = 3; // white, common
const SADNESS = 74; // black, mythic
const RAGE = 98; // red, uncommon

describe('deckModel — immutability', () => {
  it('addCopy returns a new map and leaves the original untouched', () => {
    const a: DeckCounts = new Map();
    const b = addCopy(a, CHARITY);
    expect(a.size).toBe(0);
    expect(b.get(CHARITY)).toBe(1);
    const c = addCopy(b, CHARITY);
    expect(b.get(CHARITY)).toBe(1);
    expect(c.get(CHARITY)).toBe(2);
  });

  it('subCopy deletes the key at zero', () => {
    const one = addCopy(new Map(), CHARITY);
    const gone = subCopy(one, CHARITY);
    expect(gone.has(CHARITY)).toBe(false);
    // subtracting an absent card is a no-op copy
    expect(subCopy(gone, CHARITY).size).toBe(0);
  });

  it('setCount: <=0 deletes, non-finite ignored, floors fractional', () => {
    let d: DeckCounts = new Map();
    d = setCount(d, RAGE, 3);
    expect(d.get(RAGE)).toBe(3);
    expect(setCount(d, RAGE, 0).has(RAGE)).toBe(false);
    expect(setCount(d, RAGE, -5).has(RAGE)).toBe(false);
    // non-finite returns the same reference unchanged
    expect(setCount(d, RAGE, Number.NaN)).toBe(d);
    expect(setCount(d, RAGE, Infinity)).toBe(d);
    expect(setCount(d, RAGE, 2.9).get(RAGE)).toBe(2);
  });
});

describe('deckModel — flatten / fromFlat / total', () => {
  it('flatten repeats by copies, ascending by number', () => {
    const d = new Map<number, number>([
      [RAGE, 2],
      [CHARITY, 1],
      [SADNESS, 3],
    ]);
    expect(flatten(d)).toEqual([CHARITY, SADNESS, SADNESS, SADNESS, RAGE, RAGE]);
    expect(totalCards(d)).toBe(6);
  });

  it('fromFlat round-trips through flatten', () => {
    const flat = [CHARITY, RAGE, RAGE, SADNESS];
    const counts = fromFlat(flat);
    expect(counts.get(RAGE)).toBe(2);
    expect(flatten(counts)).toEqual([...flat].sort((a, b) => a - b));
  });
});

describe('deckModel — breakdowns over the real db', () => {
  it('rarityBreakdown counts copies by rarity', () => {
    const d = new Map<number, number>([
      [ALTRUISM, 2], // rare
      [CHARITY, 1], // common
      [SADNESS, 1], // mythic
      [RAGE, 3], // uncommon
    ]);
    expect(rarityBreakdown(d, db)).toEqual({ common: 1, uncommon: 3, rare: 2, mythic: 1 });
  });

  it('colorBreakdown only lists colors that are present', () => {
    const d = new Map<number, number>([
      [ALTRUISM, 2], // white
      [CHARITY, 1], // white
      [SADNESS, 1], // black
    ]);
    expect(colorBreakdown(d, db)).toEqual({ white: 3, black: 1 });
  });

  it('breakdowns ignore numbers not in the db', () => {
    const d = new Map<number, number>([[99999, 4]]);
    expect(rarityBreakdown(d, db)).toEqual({ common: 0, uncommon: 0, rare: 0, mythic: 0 });
    expect(colorBreakdown(d, db)).toEqual({});
  });
});

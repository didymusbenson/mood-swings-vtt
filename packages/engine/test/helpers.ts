import type { CardData, Color, DieColor, Rarity } from '../src/types.js';

let n = 0;
export function card(partial: Partial<CardData> & { number: number }): CardData {
  return {
    name: `Card${partial.number}`,
    slug: `card${partial.number}`,
    color: 'white' as Color,
    rarity: 'common' as Rarity,
    value: 0,
    dieColor: 'white' as DieColor,
    secondaryValue: null,
    rulesText: null,
    image: '',
    set: '1ed',
    ...partial,
  };
}

/** Build a deck whose first 5 cards go to p1's hand and next 5 to p2's hand. */
export function riggedDeck(p1Hand: number[], p2Hand: number[], filler = 0, fillerCount = 40): number[] {
  const pad = (h: number[]) => [...h, ...Array(Math.max(0, 5 - h.length)).fill(filler)].slice(0, 5);
  return [...pad(p1Hand), ...pad(p2Hand), ...Array(fillerCount).fill(filler)];
}

export function freshNumber(): number {
  return 900 + n++;
}

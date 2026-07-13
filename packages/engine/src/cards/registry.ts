// Registry that binds a card's static data (from data/cards.json) to its
// behaviour (CardEffects). Effects are registered by collector number.

import type { CardData } from '../types.js';
import type { CardEffects } from '../effects.js';
import { NO_EFFECTS } from '../effects.js';

const effectsByNumber = new Map<number, CardEffects>();

/** Register a card's behaviour. Call once per card at module load. */
export function registerEffects(cardNumber: number, effects: CardEffects): void {
  effectsByNumber.set(cardNumber, effects);
}

export function effectsFor(cardNumber: number): CardEffects {
  return effectsByNumber.get(cardNumber) ?? NO_EFFECTS;
}

/** In-memory card database keyed by collector number. */
export class CardDB {
  private readonly byNumber = new Map<number, CardData>();

  constructor(cards: readonly CardData[] = []) {
    for (const c of cards) this.byNumber.set(c.number, c);
  }

  get(cardNumber: number): CardData {
    const c = this.byNumber.get(cardNumber);
    if (!c) throw new Error(`Unknown card #${cardNumber}`);
    return c;
  }

  has(cardNumber: number): boolean {
    return this.byNumber.has(cardNumber);
  }

  all(): CardData[] {
    return [...this.byNumber.values()];
  }

  get size(): number {
    return this.byNumber.size;
  }
}

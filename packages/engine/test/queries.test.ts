import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { CardDB } from '../src/cards/registry.js';
import type { GameState } from '../src/types.js';
import { canPlayFromHand, canPlayFromDiscard, legalDiscardPlays } from '../src/queries.js';
import '../src/cards/index.js';

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const db: CardDB = loadCardDB(JSON.parse(readFileSync(path, 'utf8')) as RawCard[]);
const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];

// 5 = Complacency (white vanilla [4]); 69 = Melancholy (permits playing from discard).
const COMP = 5;
const MELANCHOLY = 69;

function rig(p1: number[], p2: number[], filler = 55): number[] {
  const pad = (h: number[]) => [...h, ...Array(5).fill(filler)].slice(0, 5);
  return [...pad(p1), ...pad(p2), ...Array(40).fill(filler)];
}
function fresh(deck: number[]): GameState {
  const e = new Engine(db);
  return e.setup({ players: P, deck, preshuffled: true });
}

describe('canPlayFromHand (F-1)', () => {
  it('is true on a normal turn (base play available)', () => {
    const s = fresh(rig([COMP], [55]));
    expect(s.playsRemaining).toBeGreaterThan(0);
    expect(canPlayFromHand(s, 'p1')).toBe(true);
  });

  it('is FALSE when the only remaining budget is a discard-only grant', () => {
    // Simulate having spent the base play but holding a dedicated discard-play grant
    // (Grief/Angst/Harmony) — the F-1 case: hand dimmed, discard still playable.
    const s = fresh(rig([COMP], [55]));
    s.discard.push(COMP);
    const discardOnly: GameState = { ...s, playsRemaining: 0, discardPlaysRemaining: 1 };
    expect(canPlayFromHand(discardOnly, 'p1')).toBe(false);
    // ...while the discard pile is genuinely playable.
    expect(canPlayFromDiscard(discardOnly, 'p1', db)).toBe(true);
    expect(legalDiscardPlays(discardOnly, 'p1', db)).toContain(COMP);
  });

  it('is true when a HAND-sourced conditional grant remains (base play spent)', () => {
    const s = fresh(rig([COMP], [55]));
    const handGrant: GameState = {
      ...s,
      playsRemaining: 0,
      conditionalGrants: [{ constraint: { kind: 'primaryValueIn', values: [0, 1, 2] } }], // from defaults to 'hand'
    };
    expect(canPlayFromHand(handGrant, 'p1')).toBe(true);
  });

  it('is FALSE when only a discard-sourced conditional grant remains (Grace #121-style)', () => {
    const s = fresh(rig([COMP], [55]));
    const discardGrant: GameState = {
      ...s,
      playsRemaining: 0,
      conditionalGrants: [{ constraint: { kind: 'colorSharedWithControllerMoods' }, from: 'discard' }],
    };
    expect(canPlayFromHand(discardGrant, 'p1')).toBe(false);
  });

  it('Melancholy #69 + a base play: both hand and discard are playable (shared budget)', () => {
    // p1 holds Melancholy; play it so it is in play, then seed a discard target. Melancholy
    // spends a NORMAL play to play from the discard, so with playsRemaining > 0 BOTH sources
    // are offered — the indicator must name sources, not assert a play count.
    const e = new Engine(db);
    const s = e.setup({ players: P, deck: rig([MELANCHOLY], [55]), preshuffled: true });
    const g = e.apply(s, { type: 'play', player: 'p1', card: MELANCHOLY });
    // A fresh play budget for p1 with Melancholy in play and a discard target present.
    const withDiscard: GameState = { ...g, discard: [...g.discard, COMP], playsRemaining: 1 };
    expect(canPlayFromHand(withDiscard, 'p1')).toBe(true);
    expect(canPlayFromDiscard(withDiscard, 'p1', db)).toBe(true);
  });
});

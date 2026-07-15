import { describe, it, expect } from 'vitest';
import type { GameState } from '@mood-swings/engine';
import {
  computeChoosers,
  delegatedSlotIndex,
  isDelegated,
  maxPerChooser,
  mergeResponses,
  scopedPriorForChooser,
  DELEGATED_CARDS,
  SIMULTANEOUS_CARDS,
} from './delegation.js';

// Minimal GameState — computeChoosers only reads players/hands/moods lengths.
function st(hands: Record<string, number[]>, moods: Record<string, number>): GameState {
  return {
    players: [
      { id: 'p1', name: 'A', roundsWon: 0 },
      { id: 'p2', name: 'B', roundsWon: 0 },
    ],
    hands,
    moods: Object.fromEntries(
      Object.entries(moods).map(([pid, n]) => [pid, Array.from({ length: n }, (_, i) => ({ uid: `${pid}-${i}` }))]),
    ),
  } as unknown as GameState;
}

describe('delegation catalog', () => {
  it('the delegated slot is the last slot of each card', () => {
    for (const card of DELEGATED_CARDS) expect(delegatedSlotIndex(card)).toBe(1);
  });
  it('flags the delegated + simultaneous cards', () => {
    expect(isDelegated(86)).toBe(true);
    expect(isDelegated(92)).toBe(false); // Glee — no delegation
    expect([...SIMULTANEOUS_CARDS].sort()).toEqual([29, 31, 78]);
  });
  it('per-chooser max is the slot max, except Suspicion #78 (pooled → 1 each)', () => {
    expect(maxPerChooser(68, 2)).toBe(2);
    expect(maxPerChooser(78, 8)).toBe(1);
    expect(maxPerChooser(86, 1)).toBe(1);
  });
});

describe('computeChoosers', () => {
  it('#86 Compulsion → the chosen victim, only if they hold cards', () => {
    const s = st({ p1: [1], p2: [2, 3] }, { p1: 0, p2: 0 });
    expect(computeChoosers(86, s, 'p1', { players: ['p2'] })).toEqual(['p2']);
    const empty = st({ p1: [1], p2: [] }, { p1: 0, p2: 0 });
    expect(computeChoosers(86, empty, 'p1', { players: ['p2'] })).toEqual([]); // engine no-ops
  });

  it('#68 Malice → the chosen player, only with 2+ moods', () => {
    const s = st({ p1: [], p2: [] }, { p1: 0, p2: 3 });
    expect(computeChoosers(68, s, 'p1', { players: ['p2'] })).toEqual(['p2']);
    const one = st({ p1: [], p2: [] }, { p1: 0, p2: 1 });
    expect(computeChoosers(68, one, 'p1', { players: ['p2'] })).toEqual([]);
  });

  it('#78 Suspicion → each chosen player who holds cards (simultaneous)', () => {
    const s = st({ p1: [1], p2: [2] }, { p1: 0, p2: 0 });
    expect(computeChoosers(78, s, 'p1', { players: ['p1', 'p2'] }).sort()).toEqual(['p1', 'p2']);
    const oneEmpty = st({ p1: [1], p2: [] }, { p1: 0, p2: 0 });
    expect(computeChoosers(78, oneEmpty, 'p1', { players: ['p1', 'p2'] })).toEqual(['p1']);
  });

  it('#29 Avoidance → every player with a mood', () => {
    expect(computeChoosers(29, st({}, { p1: 1, p2: 1 }), 'p1', {}).sort()).toEqual(['p1', 'p2']);
    expect(computeChoosers(29, st({}, { p1: 1, p2: 0 }), 'p1', {})).toEqual(['p1']);
  });

  it('#31 Confusion → every player with a hand card', () => {
    expect(computeChoosers(31, st({ p1: [1], p2: [2] }, {}), 'p1', {}).sort()).toEqual(['p1', 'p2']);
    expect(computeChoosers(31, st({ p1: [1], p2: [] }, {}), 'p1', {})).toEqual(['p1']);
  });
});

describe('scopedPriorForChooser', () => {
  it("scopes a cardsFrom:'chosen' slot to the chooser's own hand (#78, #86)", () => {
    expect(scopedPriorForChooser(78, 'p2', { players: ['p1', 'p2'] })).toEqual({ players: ['p2'] });
    expect(scopedPriorForChooser(86, 'p2', { players: ['p2'] })).toEqual({ players: ['p2'] });
  });
  it('leaves mood-slot priors untouched (#29, #68)', () => {
    expect(scopedPriorForChooser(29, 'p2', { option: 'left' })).toEqual({ option: 'left' });
    expect(scopedPriorForChooser(68, 'p2', { players: ['p2'] })).toEqual({ players: ['p2'] });
  });
});

describe('mergeResponses', () => {
  it('pools each chooser’s cards on top of the active player’s prior choices', () => {
    const merged = mergeResponses({ players: ['p1', 'p2'], option: 'left' }, [{ cards: [10] }, { cards: [20] }]);
    expect(merged).toEqual({ players: ['p1', 'p2'], option: 'left', cards: [10, 20] });
  });
  it('pools moods across choosers', () => {
    const merged = mergeResponses({ players: ['p2'] }, [{ moods: ['p2-0', 'p2-1'] }]);
    expect(merged).toEqual({ players: ['p2'], moods: ['p2-0', 'p2-1'] });
  });
  it('is a no-op shape when there are no contributions', () => {
    expect(mergeResponses({ option: 'right' }, [])).toEqual({ option: 'right' });
  });
});

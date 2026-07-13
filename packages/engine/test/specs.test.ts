import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadCardDB, type RawCard } from '../src/data.js';
import { specFor, legalTargets, type ChoiceSlot } from '../src/cards/choice-spec.js';
import type { GameState, Mood } from '../src/types.js';
import '../src/cards/index.js'; // registers all effects + specs

const db = loadCardDB(JSON.parse(readFileSync(new URL('../../../data/cards.json', import.meta.url), 'utf8')) as RawCard[]);
const look = (n: number) => db.get(n);

// The first slot of each spec, with the fields the UI relies on.
const firstSlot = (n: number): ChoiceSlot => {
  const spec = specFor(n);
  expect(spec, `spec for #${n}`).toBeDefined();
  return spec!.slots[0]!;
};

describe('card target specs', () => {
  it('registers specs for representative interactive cards across colours', () => {
    // blue
    expect(firstSlot(28)).toMatchObject({ key: 'players', kind: 'player', max: 2 });
    expect(firstSlot(40)).toMatchObject({ key: 'cards', kind: 'handCard', min: 2, max: 2 });
    expect(firstSlot(42)).toMatchObject({ key: 'colors', kind: 'color', min: 1, max: 1 });
    expect(firstSlot(46)).toMatchObject({ key: 'moods', kind: 'mood', max: 8, mood: { from: 'own' } });
    expect(firstSlot(50)).toMatchObject({ key: 'moods', kind: 'mood', min: 2, max: 3 });
    // black
    expect(firstSlot(56)).toMatchObject({ key: 'moods', kind: 'mood', min: 1, max: 1, mood: { from: 'own' } });
    expect(firstSlot(60)).toMatchObject({ key: 'option', kind: 'choice', options: ['cards', 'wins'] });
    expect(firstSlot(64)).toMatchObject({ key: 'moods', kind: 'mood', min: 1, max: 1 });
    expect(firstSlot(78)).toMatchObject({ key: 'players', kind: 'player' });
    // red
    expect(firstSlot(82)).toMatchObject({ key: 'moods', kind: 'mood', max: 1, mood: { from: 'opponent', colorIn: ['white', 'blue'] } });
    expect(firstSlot(87)).toMatchObject({ key: 'cards', kind: 'handCard', hand: { valueIn: [4, 5, 6] } });
    expect(firstSlot(99)).toMatchObject({ key: 'option', kind: 'number', numberRange: [0, 3] });
    // green
    expect(firstSlot(107)).toMatchObject({ key: 'players', kind: 'player', min: 1, max: 1 });
    expect(firstSlot(108)).toMatchObject({ key: 'cards', kind: 'handCard', min: 1, max: 1 });
    expect(firstSlot(110)).toMatchObject({ key: 'cards', kind: 'handCard', hand: { valueIn: [0, 2, 4, 6] } });
    expect(firstSlot(133)).toMatchObject({ key: 'colors', kind: 'color', min: 1, max: 1 });
  });

  it('marks auto/intrinsic cards as having no spec', () => {
    for (const n of [27, 44, 47, 55, 63, 83, 88, 117, 127]) expect(specFor(n)).toBeUndefined();
  });

  const mk = (card: number, uid: string, owner: string, currentValue: number): Mood => ({
    uid, card, owner, stolenFrom: null, usingSecondary: false,
    suppressed: 'none', suppressedBy: null, copyOf: null, currentValue, data: {},
  });

  // A tiny two-player board for legalTargets.
  const state = {
    players: [{ id: 'p1', name: 'P1', roundsWon: 0 }, { id: 'p2', name: 'P2', roundsWon: 0 }],
    hands: { p1: [5, 55], p2: [] }, // 5 = white, 55 = black
    moods: {
      p1: [mk(5, 'm-lo', 'p1', 3), mk(5, 'm-hi', 'p1', 6)],
      p2: [mk(44, 'm-opp', 'p2', 2)], // 44 = blue
    },
  } as unknown as GameState;

  it('legalTargets honours a maxValue mood filter (excludes a [6] mood)', () => {
    // Shock (#101) second slot: moods with value <= 3.
    const slot = specFor(101)!.slots[1]!;
    expect(slot.mood?.maxValue).toBe(3);
    const legal = legalTargets(slot, state, 'p1', look).moods;
    expect(legal).toContain('m-lo'); // [3]
    expect(legal).toContain('m-opp'); // [2]
    expect(legal).not.toContain('m-hi'); // [6] excluded
  });

  it('legalTargets honours a colorIn hand filter (excludes a white card)', () => {
    const blackOnly: ChoiceSlot = { key: 'cards', kind: 'handCard', min: 0, max: 1, hand: { colorIn: ['black'] }, label: 'black only' };
    const legal = legalTargets(blackOnly, state, 'p1', look).cards;
    expect(legal).toEqual([55]); // 55 = black; 5 = white excluded
  });

  it('legalTargets honours from:opponent + colorIn on a mood slot (Arrogance #82)', () => {
    // #82 targets an opponent's white/blue mood; only p2's blue mood qualifies.
    const legal = legalTargets(specFor(82)!.slots[0]!, state, 'p1', look).moods;
    expect(legal).toEqual(['m-opp']);
  });
});

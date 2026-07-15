import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadCardDB, type RawCard } from '../src/data.js';
import { specFor, legalTargets, playedMoodQualifies, type ChoiceSlot } from '../src/cards/choice-spec.js';
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

  // Regression: "choose a player; THAT player gives/discards a card from THEIR hand"
  // cards must enumerate the chosen player's hand, not the acting player's. This was
  // the Compulsion bug — playing it as p1 and choosing p2 showed p1's OWN hand.
  describe('cardsFrom:chosen enumerates the chosen player(s) hand, not the acting hand', () => {
    // p1 (acting) holds 5; the opponent p2 holds 55 + 44.
    const twoHands = {
      players: [{ id: 'p1', name: 'P1', roundsWon: 0 }, { id: 'p2', name: 'P2', roundsWon: 0 }],
      hands: { p1: [5], p2: [55, 44] },
      moods: { p1: [], p2: [] },
      discard: [],
    } as unknown as GameState;

    it('Compulsion #86 shows the CHOSEN player p2 hand, never the acting p1 hand', () => {
      const cardsSlot = specFor(86)!.slots[1]!;
      expect(cardsSlot).toMatchObject({ key: 'cards', kind: 'handCard', cardsFrom: 'chosen' });
      const legal = legalTargets(cardsSlot, twoHands, 'p1', look, { players: ['p2'] }).cards;
      expect(legal).toEqual([55, 44]); // p2's hand
      expect(legal).not.toContain(5); // NOT p1's own card — the reported bug
    });

    it('Intimidation #67 shows the chosen opponent hand', () => {
      const cardsSlot = specFor(67)!.slots[1]!;
      expect(cardsSlot).toMatchObject({ kind: 'handCard', cardsFrom: 'chosen' });
      expect(legalTargets(cardsSlot, twoHands, 'p1', look, { players: ['p2'] }).cards).toEqual([55, 44]);
    });

    it('Suspicion #78 unions every chosen player hand', () => {
      const cardsSlot = specFor(78)!.slots[1]!;
      expect(cardsSlot).toMatchObject({ kind: 'handCard', cardsFrom: 'chosen' });
      expect(legalTargets(cardsSlot, twoHands, 'p1', look, { players: ['p1', 'p2'] }).cards).toEqual([5, 55, 44]);
    });

    it('offers nothing until a player is chosen (no fallback to the acting hand)', () => {
      const cardsSlot = specFor(86)!.slots[1]!;
      expect(legalTargets(cardsSlot, twoHands, 'p1', look, { players: [] }).cards).toEqual([]);
      expect(legalTargets(cardsSlot, twoHands, 'p1', look).cards).toEqual([]); // no ctx at all
    });

    it('a default (acting) handCard slot is unaffected — still the acting hand', () => {
      const acting: ChoiceSlot = { key: 'cards', kind: 'handCard', min: 0, max: 1, label: 'own hand' };
      expect(legalTargets(acting, twoHands, 'p1', look, { players: ['p2'] }).cards).toEqual([5]);
    });
  });

  // Regression: discard-recovery cards must enumerate the DISCARD pile, not a hand.
  // Previously they showed the acting hand, so picking never matched and the ability
  // silently no-op'd (Corruption/Cynicism/Nostalgia were effectively unusable).
  describe('cardsFrom:discard enumerates the shared discard pile', () => {
    const withDiscard = {
      players: [{ id: 'p1', name: 'P1', roundsWon: 0 }, { id: 'p2', name: 'P2', roundsWon: 0 }],
      hands: { p1: [5], p2: [44] },
      moods: { p1: [], p2: [] },
      discard: [17, 33, 111],
    } as unknown as GameState;

    it.each([[60, 1], [128, 0]] as const)('card #%i shows the discard pile', (num, slotIdx) => {
      const slot = specFor(num)!.slots[slotIdx]!;
      expect(slot).toMatchObject({ kind: 'handCard', cardsFrom: 'discard' });
      const legal = legalTargets(slot, withDiscard, 'p1', look).cards;
      expect(legal).toEqual([17, 33, 111]); // the discard pile
      expect(legal).not.toContain(5); // NOT the acting hand
    });

    it('Cynicism #62 discard slot comes first, then the opponent slot', () => {
      const slot = specFor(62)!.slots[0]!;
      expect(slot).toMatchObject({ kind: 'handCard', cardsFrom: 'discard' });
      expect(legalTargets(slot, withDiscard, 'p1', look).cards).toEqual([17, 33, 111]);
    });
  });

  // Regression: parity-restricted mood pickers must offer only legal moods, so the
  // player's pick isn't silently overridden by the effect (which filters by parity).
  describe('valueParity mood filter (Anxiety #28 odd / Spite #76 even)', () => {
    // values: m1=1(odd) m2=2(even) m3=3(odd) m4=6(even)
    const parityState = {
      players: [{ id: 'p1', name: 'P1', roundsWon: 0 }, { id: 'p2', name: 'P2', roundsWon: 0 }],
      hands: { p1: [], p2: [] },
      moods: {
        p1: [mk(5, 'm1', 'p1', 1), mk(5, 'm2', 'p1', 2)],
        p2: [mk(44, 'm3', 'p2', 3), mk(44, 'm4', 'p2', 6)],
      },
    } as unknown as GameState;

    it('Anxiety #28 offers only odd-value moods', () => {
      const slot = specFor(28)!.slots[1]!;
      expect(slot.mood?.valueParity).toBe('odd');
      expect(legalTargets(slot, parityState, 'p1', look).moods).toEqual(['m1', 'm3']);
    });

    it('Spite #76 offers only even-value moods', () => {
      const slot = specFor(76)!.slots[1]!;
      expect(slot.mood?.valueParity).toBe('even');
      expect(legalTargets(slot, parityState, 'p1', look).moods).toEqual(['m2', 'm4']);
    });
  });

  it('Anger #80 carries a maxTotalValue cap of 5 (running total enforced in the flow)', () => {
    expect(specFor(80)!.slots[0]!.mood?.maxTotalValue).toBe(5);
  });

  it('afterPlaying mood slots that may target the played mood are selfTargetable', () => {
    // Single-target "choose a/any mood" (#6/#12/#24/#66) and the "each chosen player
    // loses a mood" family (#7/#28/#76/#101) — all afterPlaying, all in play by then.
    const moodSlot = (n: number) => specFor(n)!.slots.find((sl) => sl.kind === 'mood')!;
    for (const n of [6, 12, 24, 66, 7, 28, 76, 101]) expect(moodSlot(n).selfTargetable, `#${n}`).toBe(true);
    // "another mood" / cost / opponent-only slots must NOT be self-targetable.
    for (const n of [84, 34, 40]) expect(moodSlot(n).selfTargetable ?? false, `#${n}`).toBe(false);
  });

  describe('playedMoodQualifies — the played mood is offered only when it passes the filter', () => {
    const shock = specFor(101)!.slots.find((s) => s.kind === 'mood')!; // maxValue 3
    const spite = specFor(76)!.slots.find((s) => s.kind === 'mood')!; // even
    const courage = specFor(7)!.slots.find((s) => s.kind === 'mood')!; // minValue 5
    const arrog = specFor(82)!.slots[0]!; // from: 'opponent'
    const d = (color = 'red' as const, secondaryValue: unknown = null) =>
      ({ color, secondaryValue } as unknown as Parameters<typeof playedMoodQualifies>[1]);

    it('Shock #101 (≤[3]) accepts a [2] self, rejects a [4] self', () => {
      expect(playedMoodQualifies(shock, d(), 2)).toBe(true);
      expect(playedMoodQualifies(shock, d(), 4)).toBe(false);
    });
    it('Spite #76 (even) accepts an even self, rejects an odd self', () => {
      expect(playedMoodQualifies(spite, d(), 2)).toBe(true);
      expect(playedMoodQualifies(spite, d(), 1)).toBe(false);
    });
    it('Courage #7 ([5]+) accepts a buffed [5] self, rejects the printed [1]', () => {
      expect(playedMoodQualifies(courage, d(), 5)).toBe(true);
      expect(playedMoodQualifies(courage, d(), 1)).toBe(false);
    });
    it('an opponent-only slot never accepts the (own) played mood', () => {
      expect(playedMoodQualifies(arrog, d('white'), 2)).toBe(false);
    });
  });
});

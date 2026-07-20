import { describe, it, expect } from 'vitest';
import { Engine, specFor, legalTargets, type ChoiceSlot, type GameState } from '@mood-swings/engine';
import { db } from '../game/db.js';
import { isChosenPooledSlot, pooledMax, isForcedSlot, toggleBounded } from './usePlayInteraction.js';

const look = (n: number) => db.get(n);
const slotsOf = (card: number): ChoiceSlot[] => specFor(card)!.slots;

const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];
function rig(p1: number[], p2: number[], filler = 55): number[] {
  const pad = (h: number[]) => [...h, ...Array(5).fill(filler)].slice(0, 5);
  return [...pad(p1), ...pad(p2), ...Array(40).fill(filler)];
}
function fresh(deck: number[]): { e: Engine; s: GameState } {
  const e = new Engine(db);
  return { e, s: e.setup({ players: P, deck, preshuffled: true }) };
}

// Slot references (kind/max verified against the specs).
const suspicionCards = slotsOf(78)[1]!; // handCard, cardsFrom 'chosen', pooled max 8
const maliceMood = slotsOf(68)[1]!; //     mood, from 'chosen', but single-player (guarded)
const malicePlayer = slotsOf(68)[0]!; //   player, min 1, minMoods 2
const spiteMood = slotsOf(76)[1]!; //      mood, from 'chosen', pooled max 2
const betrayalMood = slotsOf(56)[0]!; //   mood, min 1, from 'own'
const guileCards = slotsOf(40)[0]!; //     handCard, acting hand, min 2
const guileMood = slotsOf(40)[1]!; //      mood, min 1, from 'opponent'
const corruptionCards = slotsOf(60)[1]!; // handCard, cardsFrom 'discard'
const arroganceMood = slotsOf(82)[0]!; //  mood, min 0, from 'opponent', optional

describe('isChosenPooledSlot', () => {
  it('flags "one per chosen player" mood / handCard slots', () => {
    expect(isChosenPooledSlot(suspicionCards)).toBe(true);
    expect(isChosenPooledSlot(spiteMood)).toBe(true);
    expect(isChosenPooledSlot(maliceMood)).toBe(true); // from:'chosen' — guarded later by pooledMax
  });
  it('does not flag acting-hand / discard / non-chosen slots', () => {
    expect(isChosenPooledSlot(guileCards)).toBe(false); // acting hand
    expect(isChosenPooledSlot(corruptionCards)).toBe(false); // discard
    expect(isChosenPooledSlot(arroganceMood)).toBe(false); // from:'opponent'
  });
});

describe('pooledMax (F-6)', () => {
  it('caps a pooled slot at the number of chosen players', () => {
    const spec = specFor(78)!;
    expect(pooledMax(suspicionCards, spec, 1)).toBe(1); // 1 chosen player → single-select
    expect(pooledMax(suspicionCards, spec, 3)).toBe(3);
    expect(pooledMax(suspicionCards, spec, 0)).toBe(1); // never below 1
    expect(pooledMax(suspicionCards, spec, 9)).toBe(8); // never above the slot's own max
  });
  it('caps Spite #76 at the chosen count too', () => {
    expect(pooledMax(spiteMood, specFor(76)!, 1)).toBe(1);
    expect(pooledMax(spiteMood, specFor(76)!, 2)).toBe(2);
  });
  it('GUARDS Malice #68: a single-player choose-two keeps max 2', () => {
    // Malice's players slot is max:1, so its mood slot is NOT a pooled per-player slot even
    // though from:'chosen'. Its declared max 2 must survive regardless of chosen count.
    expect(pooledMax(maliceMood, specFor(68)!, 1)).toBe(2);
    expect(pooledMax(maliceMood, specFor(68)!, 0)).toBe(2);
  });
  it('leaves non-pooled slots at their declared max', () => {
    expect(pooledMax(guileCards, specFor(40)!, 0)).toBe(2);
    expect(pooledMax(arroganceMood, specFor(82)!, 0)).toBe(1);
  });
});

describe('isForcedSlot (empty-slot auto-advance / F-7a skip suppression)', () => {
  it('mandatory (min>0) target slots are always forced', () => {
    expect(isForcedSlot(malicePlayer, 0)).toBe(true); // player min 1
    expect(isForcedSlot(betrayalMood, 0)).toBe(true); // mood min 1 from own
    expect(isForcedSlot(guileMood, 0)).toBe(true); //   mood min 1 from opponent
  });
  it('a from:chosen follow-up is forced only once a player is chosen', () => {
    expect(isForcedSlot(suspicionCards, 0)).toBe(false); // no players yet → genuine skip
    expect(isForcedSlot(suspicionCards, 1)).toBe(true); //  effect committed to fire
    expect(isForcedSlot(spiteMood, 2)).toBe(true);
  });
  it('a genuine "may" (optional, non-chosen) slot is never forced', () => {
    expect(isForcedSlot(arroganceMood, 0)).toBe(false);
    expect(isForcedSlot(arroganceMood, 5)).toBe(false);
  });
});

describe('F-5 duplicate-in-zone selection (index-keyed toggle)', () => {
  it('two identical copies are independently selectable by index', () => {
    const cands = [60, 60, 55]; // legalNow.cards for a Corruption-style discard slot
    let idx: number[] = [];
    idx = toggleBounded(idx, 0, 2); // click first #60
    idx = toggleBounded(idx, 1, 2); // click second #60 — must NOT deselect the first
    expect(idx).toEqual([0, 1]);
    expect(idx.map((j) => cands[j]!)).toEqual([60, 60]); // both copies committed
  });
  it('clicking a selected index deselects only that occurrence', () => {
    const cands = [60, 60, 55];
    let idx = [0, 1];
    idx = toggleBounded(idx, 0, 2); // deselect the first #60
    expect(idx).toEqual([1]);
    expect(idx.map((j) => cands[j]!)).toEqual([60]); // its twin stays selected
  });
});

describe('empty required-slot audit — no soft-lock, effect no-ops', () => {
  it('#68 Malice: no 2+-mood player ⇒ empty forced player slot, plays as a no-op', () => {
    const { e, s } = fresh(rig([68], [55]));
    // No moods in play → the required, minMoods:2 player slot enumerates nobody.
    expect(legalTargets(malicePlayer, s, 'p1', look).players).toEqual([]);
    expect(isForcedSlot(malicePlayer, 0)).toBe(true); // ⇒ the flow auto-advances instead of trapping
    // Dispatching with empty choices (what auto-advance submits) is legal and a no-op.
    const g = e.apply(s, { type: 'play', player: 'p1', card: 68, choices: {} });
    expect(g.moods['p1']!.map((m) => m.card)).toEqual([68]); // Malice in play, nothing discarded
    expect(g.activePlayer).toBe('p2'); // turn advanced — not stuck
  });

  it('#56 Betrayal: no own mood ⇒ empty forced from:own slot, plays as a no-op', () => {
    const { e, s } = fresh(rig([56], [55]));
    expect(legalTargets(betrayalMood, s, 'p1', look).moods).toEqual([]);
    expect(isForcedSlot(betrayalMood, 0)).toBe(true);
    const g = e.apply(s, { type: 'play', player: 'p1', card: 56, choices: {} });
    expect(g.moods['p1']!.some((m) => m.card === 56)).toBe(true);
  });

  it('#40 Guile: no opponent mood ⇒ empty forced from:opponent slot, still playable', () => {
    const { e, s } = fresh(rig([40, 55, 55, 55, 55], [55]));
    expect(legalTargets(guileMood, s, 'p1', look).moods).toEqual([]);
    expect(isForcedSlot(guileMood, 0)).toBe(true);
    // Guile is legally playable (hand ≥ 3); its opponent-mood grab simply finds nothing.
    const g = e.apply(s, { type: 'play', player: 'p1', card: 40, choices: {} });
    expect(g.moods['p1']!.some((m) => m.card === 40)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { CardDB, registerEffects } from '../src/cards/registry.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { GameState, Mood, PlayerId } from '../src/types.js';
import { wouldBeValue, valueProvenance } from '../src/value-transparency.js';
import { highlightFor } from '../src/cards/highlights.js';
import { card } from './helpers.js';
import '../src/cards/index.js'; // registers real-card effects + highlights

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const realDb: CardDB = loadCardDB(JSON.parse(readFileSync(path, 'utf8')) as RawCard[]);
const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];
const COMP = 5; // Complacency — white vanilla [4]

/** A valid base state; deck padded with Apathy (#55) so setup succeeds. */
function base(db: CardDB): { e: Engine; s: GameState } {
  const e = new Engine(db);
  const s = e.setup({ players: P, deck: Array(50).fill(55), preshuffled: true });
  return { e, s };
}

/** Push a fresh mood onto the board (bypasses turn machinery) and return it. */
function addMood(s: GameState, player: PlayerId, cardNumber: number): Mood {
  const m: Mood = {
    uid: `m${s.uidCounter++}`,
    card: cardNumber,
    owner: player,
    stolenFrom: null,
    usingSecondary: false,
    suppressed: 'none',
    suppressedBy: null,
    copyOf: null,
    currentValue: 0,
    data: { playedRound: s.round },
  };
  (s.moods[player] ??= []).push(m);
  return m;
}

describe('wouldBeValue', () => {
  it('#77 Superiority: self-inclusion flips a tie into "most moods"', () => {
    const { e, s } = base(realDb);
    // Existing board: p1 has 2 moods, p2 has 2 moods (a tie without the played card).
    addMood(s, 'p1', COMP);
    addMood(s, 'p1', COMP);
    addMood(s, 'p2', COMP);
    addMood(s, 'p2', COMP);
    e.stabilise(s);

    // Playing Superiority makes p1 3 vs p2 2 → "more moods" → [6][1] = 7.
    const r = wouldBeValue(realDb, s, 'p1', 77);
    expect(r.objective).toBe(true);
    expect(r.value).toBe(7);
    expect(r.printed).toBe(3);
    expect(r.computed).toBe(true);

    // Real state was NOT mutated by the dry-run.
    expect(s.moods['p1']!.length).toBe(2);
  });

  it('#77 Superiority: still tied after self-inclusion → printed [3]', () => {
    const { e, s } = base(realDb);
    addMood(s, 'p1', COMP); // p1 has 1
    addMood(s, 'p2', COMP);
    addMood(s, 'p2', COMP); // p2 has 2
    e.stabilise(s);
    const r = wouldBeValue(realDb, s, 'p1', 77); // p1 becomes 2, ties p2 → 3
    expect(r.value).toBe(3);
    expect(r.computed).toBe(false);
  });

  it('#81 Animosity: [5] when an opponent holds three or more cards, else [3]', () => {
    const { s } = base(realDb); // each player starts with 5 cards in hand
    const hot = wouldBeValue(realDb, s, 'p1', 81);
    expect(hot.value).toBe(5);
    expect(hot.computed).toBe(true);

    s.hands['p2'] = s.hands['p2']!.slice(0, 2); // opponent now holds 2 → condition fails
    const cold = wouldBeValue(realDb, s, 'p1', 81);
    expect(cold.value).toBe(3);
    expect(cold.computed).toBe(false);
  });

  it('#21 Patience uses this-turn value in the would-be (played this round → [1])', () => {
    const { s } = base(realDb);
    const r = wouldBeValue(realDb, s, 'p1', 21);
    expect(r.value).toBe(1);
  });

  it('target-dependent cards have no passive would-be until choices are supplied', () => {
    const { s } = base(realDb);
    const passive = wouldBeValue(realDb, s, 'p1', 32); // Creativity (copy)
    expect(passive.objective).toBe(false);
    expect(passive.value).toBeNull();

    // With a copy target chosen (decision modal), it resolves to the copied value.
    const chosen = wouldBeValue(realDb, s, 'p1', 32, { copy: COMP });
    expect(chosen.objective).toBe(true);
    expect(chosen.value).toBe(4); // copies Complacency [4]
  });
});

describe('valueProvenance — self', () => {
  it('#77 Superiority: own clause drives value when it has the most moods', () => {
    const { e, s } = base(realDb);
    const sup = addMood(s, 'p1', 77);
    addMood(s, 'p2', COMP); // p1 has 1 (the Superiority), p2 has 1 → tie
    e.stabilise(s);

    // Tied → printed [3], own clause not driving.
    const tied = valueProvenance(realDb, s, sup);
    expect(tied.current).toBe(3);
    expect(tied.computed).toBe(false);
    expect(tied.self).toBeNull();

    // Give p1 a second mood → p1 has 2 vs 1 → clause fires.
    addMood(s, 'p1', COMP);
    e.stabilise(s);
    const winning = valueProvenance(realDb, s, sup);
    expect(winning.current).toBe(7);
    expect(winning.computed).toBe(true);
    expect(winning.self?.cardNumber).toBe(77);
    expect(winning.self?.clause).toBe(highlightFor(77)!.clause);
    expect(winning.external).toEqual([]);
  });
});

// ---- synthetic cards for the external-modifier / suppression cases -----------
const PLAIN5 = 820; // white fixed [5]
const DAMP = 821; // white [0], reduces other white moods by 3 while in play
const SUPPRESSOR = 822; // green [0]

registerEffects(DAMP, {
  whileInPlay: () => [
    {
      appliesTo: (m, ctx) => m.uid !== ctx.self.uid && ctx.card(m).color === 'white',
      op: { kind: 'add', n: -3 },
    },
  ],
});

function synthDb(): CardDB {
  return new CardDB([
    card({ number: PLAIN5, color: 'white', value: 5 }),
    card({ number: DAMP, name: 'Damp', color: 'white', value: 0 }),
    card({ number: SUPPRESSOR, name: 'Suppressor', color: 'green', value: 0 }),
  ]);
}

describe('valueProvenance — external', () => {
  it('names another card that reduces this mood via a while-in-play modifier', () => {
    const db = synthDb();
    const e = new Engine(db);
    const s = e.setup({ players: P, deck: Array(20).fill(PLAIN5), preshuffled: true });
    const target = addMood(s, 'p1', PLAIN5);
    addMood(s, 'p2', DAMP);
    e.stabilise(s);

    const prov = valueProvenance(db, s, target);
    expect(prov.printed).toBe(5);
    expect(prov.current).toBe(2); // 5 - 3
    expect(prov.computed).toBe(true);
    expect(prov.self).toBeNull();
    expect(prov.external).toHaveLength(1);
    expect(prov.external[0]!.name).toBe('Damp');
    expect(prov.external[0]!.kind).toBe('modifier');
  });

  it('names the sustained suppressor forcing a mood to 0', () => {
    const db = synthDb();
    const e = new Engine(db);
    const s = e.setup({ players: P, deck: Array(20).fill(PLAIN5), preshuffled: true });
    const target = addMood(s, 'p1', PLAIN5);
    const suppressor = addMood(s, 'p2', SUPPRESSOR);
    target.suppressed = 'sustained';
    target.suppressedBy = suppressor.uid;
    e.stabilise(s);

    const prov = valueProvenance(db, s, target);
    expect(prov.current).toBe(0);
    expect(prov.computed).toBe(true);
    expect(prov.external).toHaveLength(1);
    expect(prov.external[0]!.name).toBe('Suppressor');
    expect(prov.external[0]!.kind).toBe('suppress');
  });
});

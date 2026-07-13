import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { CardDB } from '../src/cards/registry.js';
import type { GameState } from '../src/types.js';
import '../src/cards/black.js';

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const db: CardDB = loadCardDB(JSON.parse(readFileSync(path, 'utf8')) as RawCard[]);
const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];

// Card refs used below: 5 = Complacency (white vanilla [4]), 55 = Apathy (black vanilla [4]).
const COMP = 5;

/** Deck rigged so p1's hand = first 5, p2's = next 5. Filler = black vanilla Apathy. */
function rig(p1: number[], p2: number[], filler = 55): number[] {
  const pad = (h: number[]) => [...h, ...Array(5).fill(filler)].slice(0, 5);
  return [...pad(p1), ...pad(p2), ...Array(40).fill(filler)];
}
const game = (deck: number[]) => {
  const e = new Engine(db);
  return { e, s: e.setup({ players: P, deck, preshuffled: true }) };
};

/** Play a full 2-player round where both players each play one card / pass. */
function findMood(g: GameState, player: 'p1' | 'p2', card: number) {
  return g.moods[player]!.find((m) => m.card === card);
}

describe('black cards', () => {
  it('#63 Disgust is [6] alone and [3] with two green/white moods', () => {
    // [6] branch: Disgust alone.
    {
      const { e, s } = game(rig([63], [55]));
      const g = e.apply(s, { type: 'play', player: 'p1', card: 63 });
      expect(findMood(g, 'p1', 63)!.currentValue).toBe(6);
    }
    // [3] branch: two white Complacencies in play, then Disgust.
    const { e, s } = game(rig([COMP, 63], [COMP]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: COMP });
    g = e.apply(g, { type: 'play', player: 'p2', card: COMP }); // two whites; round ends
    g = e.apply(g, { type: 'play', player: 'p1', card: 63 }); // r2, p1 leads
    expect(findMood(g, 'p1', 63)!.currentValue).toBe(3);
  });

  it('#77 Superiority is [7] with the most moods, [3] when tied', () => {
    const { e, s } = game(rig([77], [COMP]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 77 });
    expect(findMood(g, 'p1', 77)!.currentValue).toBe(7); // p1 has 1, p2 has 0
    g = e.apply(g, { type: 'play', player: 'p2', card: COMP }); // now 1-1 tie
    expect(findMood(g, 'p1', 77)!.currentValue).toBe(3);
  });

  it('#64 Envy: cost discards a mood; value = moodiest opponent mood count; unplayable with no moods', () => {
    // Cannot play with no moods in play.
    const fresh = game(rig([64], [COMP]));
    expect(() => fresh.e.apply(fresh.s, { type: 'play', player: 'p1', card: 64 })).toThrow();

    // With a mood to sacrifice: value tracks p2's mood count.
    const { e, s } = game(rig([COMP, 64], [COMP]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: COMP });
    g = e.apply(g, { type: 'play', player: 'p2', card: COMP }); // r1 ends; p1 leads r2
    const sacrifice = findMood(g, 'p1', COMP)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 64, choices: { moods: [sacrifice] } });
    expect(findMood(g, 'p1', COMP)).toBeUndefined(); // sacrificed
    expect(g.discard).toContain(COMP);
    expect(findMood(g, 'p1', 64)!.currentValue).toBe(2); // p2 has one mood, +[2] each
  });

  it('#75 Self-Loathing: cost discards your mood; unplayable with no moods', () => {
    const fresh = game(rig([75], [COMP]));
    expect(() => fresh.e.apply(fresh.s, { type: 'play', player: 'p1', card: 75 })).toThrow();

    const { e, s } = game(rig([COMP, 75], [COMP]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: COMP });
    g = e.apply(g, { type: 'play', player: 'p2', card: COMP });
    const sac = findMood(g, 'p1', COMP)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 75, choices: { moods: [sac] } });
    expect(findMood(g, 'p1', COMP)).toBeUndefined();
    expect(findMood(g, 'p1', 75)!.currentValue).toBe(6);
  });

  it('#56 Betrayal gives a mood away, then reclaims it after scoring', () => {
    const { e, s } = game(rig([COMP, 56], [COMP]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: COMP });
    g = e.apply(g, { type: 'play', player: 'p2', card: COMP }); // r1 ends; p1 leads r2
    const given = findMood(g, 'p1', COMP)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 56, choices: { moods: [given], players: ['p2'] } });
    // During the turn, p2 controls the given mood.
    expect(g.moods.p2!.some((m) => m.uid === given)).toBe(true);
    expect(g.moods.p1!.map((m) => m.card)).toEqual([56]);
    g = e.apply(g, { type: 'pass', player: 'p2' }); // scoring + afterScoring reclaim
    // After scoring, the given mood is back with p1.
    expect(g.moods.p1!.some((m) => m.uid === given)).toBe(true);
    expect(g.moods.p2!.some((m) => m.uid === given)).toBe(false);
  });

  it('#57 Bitterness discards every other mood sharing the most common colour', () => {
    const { e, s } = game(rig([COMP, 57], [COMP]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: COMP }); // white
    g = e.apply(g, { type: 'play', player: 'p2', card: COMP }); // white; whites=2 most common
    g = e.apply(g, { type: 'play', player: 'p1', card: 57 }); // r2: Bitterness (black)
    expect(g.moods.p1!.map((m) => m.card)).toEqual([57]); // its own white gone, itself kept
    expect(g.moods.p2!.length).toBe(0); // p2's white discarded
    expect(g.discard.filter((c) => c === COMP).length).toBe(2);
  });

  it('#73 Rejection discards two chosen moods that share a colour or value', () => {
    const { e, s } = game(rig([COMP, 73], [COMP]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: COMP });
    g = e.apply(g, { type: 'play', player: 'p2', card: COMP }); // two identical whites
    const a = findMood(g, 'p1', COMP)!.uid;
    const b = findMood(g, 'p2', COMP)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 73, choices: { moods: [a, b] } });
    expect(g.moods.p1!.map((m) => m.card)).toEqual([73]);
    expect(g.moods.p2!.length).toBe(0);
  });

  it('#53 Ambition discards a hand card to grant an additional play', () => {
    // p1: Ambition(53), Complacency(5), extra filler. Discard filler, play again.
    const { e, s } = game(rig([53, COMP, 55], [55]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 53, choices: { cards: [55] } });
    expect(g.activePlayer).toBe('p1'); // still p1 — extra play granted
    expect(g.discard).toContain(55); // the discarded hand card
    g = e.apply(g, { type: 'play', player: 'p1', card: COMP });
    expect(g.moods.p1!.map((m) => m.card).sort((x, y) => x - y)).toEqual([5, 53]);
  });

  it('#69 Melancholy lets a discard-pile card be played (and gates hand vs discard)', () => {
    // p1: Ambition(53) to seed the discard, Melancholy(69), plus a red Boredom(83) to replay.
    const { e, s } = game(rig([53, 69, 83, 5, 5], [55]));
    // r1: Ambition discards Boredom(83) to the pile and grants a HAND play.
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 53, choices: { cards: [83] } });
    expect(g.discard).toContain(83);
    expect(g.activePlayer).toBe('p1'); // extra play granted
    // Without any discard-play permission yet, a from:'discard' play is illegal.
    expect(() => e.apply(g, { type: 'play', player: 'p1', card: 83, from: 'discard' })).toThrow();
    // Spend the granted hand play on Melancholy; that ends p1's turn.
    g = e.apply(g, { type: 'play', player: 'p1', card: 69 });
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 (5) beats p2 (0); p1 leads r2
    expect(g.activePlayer).toBe('p1');
    expect(g.discard).toContain(83);
    // Gating: a hand card cannot be played as a discard play, and vice-versa.
    expect(() => e.apply(g, { type: 'play', player: 'p1', card: 5, from: 'discard' })).toThrow();
    expect(() => e.apply(g, { type: 'play', player: 'p1', card: 83, from: 'hand' })).toThrow();
    // With Melancholy in play, the discard card resolves via a normal play.
    g = e.apply(g, { type: 'play', player: 'p1', card: 83, from: 'discard' });
    expect(findMood(g, 'p1', 83)).toBeDefined();
    expect(g.discard).not.toContain(83);
  });

  it('#54 Angst discards a blue/red mood to grant a discard-pile play', () => {
    // r1: p1 plays a red Boredom(83); r2: Angst sacrifices it and replays it from discard.
    const { e, s } = game(rig([83, 54, 5, 5, 5], [55]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 83 });
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 (4) beats p2 (0); p1 leads r2
    const redUid = findMood(g, 'p1', 83)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 54, choices: { moods: [redUid] } });
    expect(findMood(g, 'p1', 83)).toBeUndefined(); // sacrificed to the pile
    expect(g.discard).toContain(83);
    expect(g.discardPlaysRemaining).toBe(1);
    expect(g.activePlayer).toBe('p1'); // discard-play grant keeps the turn open
    // The grant only permits a discard-sourced play.
    expect(() => e.apply(g, { type: 'play', player: 'p1', card: 5, from: 'discard' })).toThrow();
    g = e.apply(g, { type: 'play', player: 'p1', card: 83, from: 'discard' });
    expect(findMood(g, 'p1', 83)).toBeDefined();
    expect(g.discard).not.toContain(83);
    expect(g.discardPlaysRemaining).toBe(0);
  });

  it('#74 Sadness gains [2] per card in the discard pile', () => {
    // Ambition discards one card, then Sadness sees a 1-card discard pile.
    const { e, s } = game(rig([53, 74, 55], [55]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 53, choices: { cards: [55] } });
    g = e.apply(g, { type: 'play', player: 'p1', card: 74 });
    expect(g.discard.length).toBe(1);
    expect(findMood(g, 'p1', 74)!.currentValue).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { CardDB } from '../src/cards/registry.js';
import type { GameState } from '../src/types.js';
import '../src/cards/blue.js';

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const db: CardDB = loadCardDB(JSON.parse(readFileSync(path, 'utf8')) as RawCard[]);
const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];

// Handy neutral cards: 5 Complacency (white,4 vanilla), 55 Apathy (black,4 vanilla),
// 83 Boredom (red,4 vanilla), 44 Indifference (blue,4 vanilla).
/** Deck rigged so p1's hand = first 5, p2's = next 5. */
function rig(p1: number[], p2: number[], filler = 5): number[] {
  const pad = (h: number[]) => [...h, ...Array(5).fill(filler)].slice(0, 5);
  return [...pad(p1), ...pad(p2), ...Array(40).fill(filler)];
}
const game = (deck: number[]) => {
  const e = new Engine(db);
  return { e, s: e.setup({ players: P, deck, preshuffled: true }) };
};

describe('blue cards', () => {
  it('#27 Ambivalence is [6] alone, [3] with two red/green moods', () => {
    // p1 plays Ambivalence; p2 brings two red (Boredom) moods into play.
    const { e, s } = game(rig([27], [83, 83], 83));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 27 });
    expect(g.moods.p1![0]!.currentValue).toBe(6);
    g = e.apply(g, { type: 'play', player: 'p2', card: 83 }); // one red -> round ends
    if (g.activePlayer === 'p2') g = e.apply(g, { type: 'play', player: 'p2', card: 83 });
    else {
      g = e.apply(g, { type: 'pass', player: g.activePlayer });
      g = e.apply(g, { type: 'play', player: 'p2', card: 83 });
    }
    expect(g.moods.p1![0]!.currentValue).toBe(3); // two red moods in play
  });

  it('#47 Obsession is [3] alone, [6] with two white/black moods', () => {
    const { e, s } = game(rig([47], [55, 55], 55));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 47 });
    expect(g.moods.p1![0]!.currentValue).toBe(3);
    g = e.apply(g, { type: 'play', player: 'p2', card: 55 }); // one black
    if (g.activePlayer === 'p2') g = e.apply(g, { type: 'play', player: 'p2', card: 55 });
    else {
      g = e.apply(g, { type: 'pass', player: g.activePlayer });
      g = e.apply(g, { type: 'play', player: 'p2', card: 55 });
    }
    expect(g.moods.p1![0]!.currentValue).toBe(6); // two black moods in play
  });

  it('#33 Curiosity becomes [6] when the revealed card shares a colour', () => {
    // filler 44 = blue Indifference, so any revealed card is blue and shares with Curiosity.
    const { e, s } = game(rig([33], [44], 44));
    const g = e.apply(s, { type: 'play', player: 'p1', card: 33, choices: { players: ['p1'] } });
    expect(g.moods.p1![0]!.currentValue).toBe(6);
  });

  it('#34 Denial returns two same-value moods to their hands', () => {
    // r1: p1 Complacency(4), p2 Boredom(4) -> both value 4. r2: p1 Denial targets both.
    const { e, s } = game(rig([5, 34], [83]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 5 });
    g = e.apply(g, { type: 'play', player: 'p2', card: 83 }); // round scored (tie -> p1)
    const comp = g.moods.p1!.find((m) => m.card === 5)!.uid;
    const bored = g.moods.p2!.find((m) => m.card === 83)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 34, choices: { moods: [comp, bored] } });
    expect(g.moods.p1!.map((m) => m.card)).toEqual([34]); // Complacency left play
    expect(g.moods.p2!.length).toBe(0); // Boredom returned
    expect(g.hands.p2!).toContain(83);
  });

  it('#35 Disorientation returns every other mood with the chosen value', () => {
    const { e, s } = game(rig([5, 35], [5]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 5 });
    g = e.apply(g, { type: 'pass', player: 'p2' });
    g = e.apply(g, { type: 'play', player: 'p1', card: 35, choices: { option: 4 } });
    expect(g.moods.p1!.map((m) => m.card)).toEqual([35]); // Complacency(4) returned, itself [0] stays
    expect(g.hands.p1!).toContain(5);
  });

  it('#46 Neurosis needs a mood in play and returns one when played', () => {
    // No moods yet -> cannot play.
    const bad = game(rig([46], [5]));
    expect(() => bad.e.apply(bad.s, { type: 'play', player: 'p1', card: 46 })).toThrow();
    // With a mood in play, cost returns it to hand.
    const { e, s } = game(rig([5, 46], [5]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 5 });
    g = e.apply(g, { type: 'pass', player: 'p2' });
    const comp = g.moods.p1!.find((m) => m.card === 5)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 46, choices: { moods: [comp] } });
    expect(g.moods.p1!.map((m) => m.card)).toEqual([46]);
    expect(g.hands.p1!).toContain(5);
  });

  it('#40 Guile discards two cards and steals an opponent mood', () => {
    // r1: p1 Complacency, p2 Boredom (tie -> p1). r2: p1 plays Guile, takes Boredom.
    const { e, s } = game(rig([5, 40], [83]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 5 });
    g = e.apply(g, { type: 'play', player: 'p2', card: 83 });
    const bored = g.moods.p2!.find((m) => m.card === 83)!.uid;
    const handBefore = g.hands.p1!.length;
    const discardBefore = g.discard.length;
    g = e.apply(g, { type: 'play', player: 'p1', card: 40, choices: { moods: [bored] } });
    expect(g.moods.p2!.length).toBe(0); // Boredom stolen
    expect(g.moods.p1!.map((m) => m.card).sort((a, b) => a - b)).toEqual([5, 40, 83]);
    expect(g.discard.length).toBe(discardBefore + 2); // two cards discarded to play Guile
    expect(g.hands.p1!.length).toBe(handBefore - 3); // -1 Guile played, -2 discarded
  });

  it('#30 Bashfulness bottom-decks itself and draws when its player wins', () => {
    const { e, s } = game(rig([30], [5]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 30 }); // 6 vs 0 -> p1 wins
    g = e.apply(g, { type: 'pass', player: 'p2' });
    expect(g.moods.p1!.some((m) => m.card === 30)).toBe(false); // left play after scoring
    expect(g.deck[g.deck.length - 1]).toBe(30); // put on bottom of deck
  });

  it('#51 Sneakiness swaps scores and flips the round winner', () => {
    // p1 Sneakiness (5) targeting p2; p2 Ambivalence (6 alone). Swap -> p1 6, p2 5 -> p1 wins.
    const { e, s } = game(rig([51], [27]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 51, choices: { players: ['p2'] } });
    g = e.apply(g, { type: 'play', player: 'p2', card: 27 });
    expect(g.players.find((p) => p.id === 'p1')!.roundsWon).toBe(1); // won thanks to the swap
    expect(g.players.find((p) => p.id === 'p2')!.roundsWon).toBe(0);
  });

  it('#48 Panic returns a chosen opponent mood (never itself) to hand', () => {
    const { e, s } = game(rig([5, 48], [83]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 5 });
    g = e.apply(g, { type: 'play', player: 'p2', card: 83 });
    const bored = g.moods.p2!.find((m) => m.card === 83)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 48, choices: { players: ['p2'], moods: [bored] } });
    expect(g.moods.p2!.length).toBe(0);
    expect(g.hands.p2!).toContain(83);
    expect(g.moods.p1!.some((m) => m.card === 48)).toBe(true); // Panic stays in play
  });
});

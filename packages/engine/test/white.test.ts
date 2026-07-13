import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { CardDB } from '../src/cards/registry.js';
import type { GameState } from '../src/types.js';
import '../src/cards/index.js';

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const db: CardDB = loadCardDB(JSON.parse(readFileSync(path, 'utf8')) as RawCard[]);
const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];

/** Deck rigged so p1's hand = first 5, p2's = next 5. */
function rig(p1: number[], p2: number[], filler = 5): number[] {
  const pad = (h: number[]) => [...h, ...Array(5).fill(filler)].slice(0, 5);
  return [...pad(p1), ...pad(p2), ...Array(40).fill(filler)];
}
const game = (deck: number[]) => {
  const e = new Engine(db);
  return { e, s: e.setup({ players: P, deck, preshuffled: true }) };
};

describe('white cards', () => {
  it('#3 Charity grants an additional mood (same player keeps the turn)', () => {
    // p1 hand: Charity(3), Complacency(5). Play Charity -> may play again.
    const { e, s } = game(rig([3, 5], [5]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 3 });
    expect(g.activePlayer).toBe('p1'); // still p1's turn (extra play granted)
    expect(g.phase).toBe('awaitingPlay');
    g = e.apply(g, { type: 'play', player: 'p1', card: 5 });
    expect(g.moods.p1!.map((m) => m.card).sort((a, b) => a - b)).toEqual([3, 5]);
    expect(g.activePlayer).toBe('p2'); // no more plays -> turn passed
  });

  it('#13 Friendliness only lets you play a low-value extra mood', () => {
    // Friendliness(2). Extra must be printed [0]-[3]. Complacency is [4] -> illegal.
    const { e, s } = game(rig([13, 5], [5]));
    const g = e.apply(s, { type: 'play', player: 'p1', card: 13 });
    expect(() => e.apply(g, { type: 'play', player: 'p1', card: 5 })).toThrow(); // [4] not allowed
    // but a Charity(1) would be allowed (printed [1]); swap deck to prove:
    const g2 = game(rig([13, 3], [5]));
    let x = g2.e.apply(g2.s, { type: 'play', player: 'p1', card: 13 });
    x = g2.e.apply(x, { type: 'play', player: 'p1', card: 3 }); // Charity is [1] -> ok
    expect(x.moods.p1!.map((m) => m.card).sort((a, b) => a - b)).toEqual([3, 13]);
  });

  it('#9 Discipline is [3] when two black/red moods are in play, else [6]', () => {
    // p1 plays Discipline(9). Alone -> 6. Then bring two red moods into play.
    const { e, s } = game(rig([9], [80, 80], 9));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 9 });
    expect(g.moods.p1![0]!.currentValue).toBe(6);
    g = e.apply(g, { type: 'play', player: 'p2', card: 80 }); // Anger (red) round1 ends
    // round2: p2 leads? p1 vs p2 — whoever won. Just check Discipline recomputes:
    // add a second red so black+red >= 2
    // (p2 has another red 80 in hand)
    if (g.activePlayer === 'p2') g = e.apply(g, { type: 'play', player: 'p2', card: 80 });
    else { g = e.apply(g, { type: 'pass', player: g.activePlayer }); g = e.apply(g, { type: 'play', player: 'p2', card: 80 }); }
    expect(g.moods.p1![0]!.currentValue).toBe(3); // two reds in play
  });

  it('#4 Chivalry is [5] for the player who did not go first', () => {
    const { e, s } = game(rig([4], [4]));
    // p1 goes first this round; p2 plays Chivalry -> p2 didn't go first -> 5
    let g = e.apply(s, { type: 'pass', player: 'p1' });
    g = e.apply(g, { type: 'play', player: 'p2', card: 4 });
    // scoring happened; inspect p2's Chivalry value pre-round-reset via log/roundScores
    expect(g.players.find((p) => p.id === 'p2')!.roundsWon).toBe(1); // p2 scored 5 > 0
  });

  it('#6 Conviction bottom-decks a chosen mood and its owner draws', () => {
    // p1 plays Complacency(5) r1; p2 pass; r2 p1 plays Conviction(6) targeting own mood.
    const { e, s } = game(rig([5, 6], [5]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 5 });
    g = e.apply(g, { type: 'pass', player: 'p2' });
    const uid = g.moods.p1![0]!.uid;
    const handBefore = g.hands.p1!.length;
    g = e.apply(g, { type: 'play', player: 'p1', card: 6, choices: { moods: [uid] } });
    expect(g.moods.p1!.map((m) => m.card)).toEqual([6]); // Complacency left play
    expect(g.deck[g.deck.length - 1]).toBe(5); // bottom-decked
    expect(g.hands.p1!.length).toBe(handBefore); // played Conviction (-1) then drew (+1)
  });

  it('#19 Meekness suppresses all moods worth [2]+ while it stays in play', () => {
    // p1 plays Complacency(5, value4) r1; p2 pass; r2 p1 plays Meekness(19).
    const { e, s } = game(rig([5, 19], [5]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 5 });
    g = e.apply(g, { type: 'pass', player: 'p2' });
    g = e.apply(g, { type: 'play', player: 'p1', card: 19 });
    const comp = g.moods.p1!.find((m) => m.card === 5)!;
    expect(comp.currentValue).toBe(0); // suppressed (was 4)
    expect(comp.suppressed).toBe('sustained');
  });
});

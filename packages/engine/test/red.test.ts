import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { CardDB } from '../src/cards/registry.js';
import type { GameState, Mood, PlayerId } from '../src/types.js';
import '../src/cards/red.js';

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const db: CardDB = loadCardDB(JSON.parse(readFileSync(path, 'utf8')) as RawCard[]);
const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];

/** Deck rigged so p1's hand = first 5, p2's = next 5. Filler #5 = Complacency (white [4], vanilla). */
function rig(p1: number[], p2: number[], filler = 5): number[] {
  const pad = (h: number[]) => [...h, ...Array(5).fill(filler)].slice(0, 5);
  return [...pad(p1), ...pad(p2), ...Array(40).fill(filler)];
}
const game = (deck: number[]) => {
  const e = new Engine(db);
  return { e, s: e.setup({ players: P, deck, preshuffled: true }) };
};

let uid = 0;
function mkMood(card: number, owner: PlayerId): Mood {
  return {
    uid: `t${uid++}`, card, owner, stolenFrom: null, usingSecondary: false,
    suppressed: 'none', suppressedBy: null, copyOf: null, currentValue: 0, data: {},
  };
}

describe('red cards', () => {
  it('#92 Glee is [6] the round it is played, [0] afterwards', () => {
    const { e, s } = game(rig([92], [5]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 92 });
    expect(g.moods.p1![0]!.currentValue).toBe(6); // played this round
    g = e.apply(g, { type: 'pass', player: 'p2' }); // round scores; p1 (6) wins
    expect(g.round).toBe(2);
    expect(g.moods.p1![0]!.currentValue).toBe(0); // no longer the round it was played
    expect(g.players.find((p) => p.id === 'p1')!.roundsWon).toBe(1);
  });

  it('#98 Rage discards all other moods worth [2] or less', () => {
    // p1 plays Anger([0], no targets); p2 plays Rage opting in with option:'all'.
    const { e, s } = game(rig([80], [98]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 80 });
    expect(g.moods.p1![0]!.currentValue).toBe(0);
    g = e.apply(g, { type: 'play', player: 'p2', card: 98, choices: { option: 'all' } });
    expect(g.moods.p1!.length).toBe(0); // Anger (value 0 <= 2) was discarded
    expect(g.discard).toContain(80);
    expect(g.moods.p2!.some((m) => m.card === 98)).toBe(true); // Rage never hits itself
  });

  it('#99 Rebellion discards all other moods of a chosen value', () => {
    // p1 plays Shock([2], no players chosen -> no-op); p2 plays Rebellion choosing [2].
    const { e, s } = game(rig([101], [99]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 101 });
    expect(g.moods.p1![0]!.currentValue).toBe(2);
    g = e.apply(g, { type: 'play', player: 'p2', card: 99, choices: { option: 2 } });
    expect(g.moods.p1!.length).toBe(0); // the value-2 Shock was discarded
    expect(g.discard).toContain(101);
    expect(g.moods.p2!.some((m) => m.card === 99)).toBe(true);
  });

  it('#90 Frustration is [3] when two white/blue moods are in play, else [6]', () => {
    // Round 1: both players play a white Complacency (#5). Round 2: p1 plays
    // Frustration with two whites already in play.
    const { e, s } = game(rig([5, 90], [5]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 5 });
    g = e.apply(g, { type: 'play', player: 'p2', card: 5 }); // tie -> p1 leads round 2
    expect(g.round).toBe(2);
    g = e.apply(g, { type: 'play', player: 'p1', card: 90 });
    const frus = g.moods.p1!.find((m) => m.card === 90)!;
    expect(frus.currentValue).toBe(3); // two white Complacency moods in play
  });

  it('#87 Embarrassment becomes [5] after discarding a [4]/[5]/[6] hand card', () => {
    const { e, s } = game(rig([87, 5], [5]));
    const g = e.apply(s, { type: 'play', player: 'p1', card: 87, choices: { cards: [5] } });
    expect(g.moods.p1![0]!.currentValue).toBe(5); // Complacency (#5) is a [4]
    expect(g.discard).toContain(5);
    // Without the discard it stays [3].
    const g2 = game(rig([87, 5], [5]));
    const x = g2.e.apply(g2.s, { type: 'play', player: 'p1', card: 87 });
    expect(x.moods.p1![0]!.currentValue).toBe(3);
  });

  it('#82 Arrogance takes an opponent white/blue mood', () => {
    const { e, s } = game(rig([5], [82]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 5 }); // white Complacency
    const uid = g.moods.p1![0]!.uid;
    g = e.apply(g, { type: 'play', player: 'p2', card: 82, choices: { moods: [uid] } });
    expect(g.moods.p2!.some((m) => m.card === 5)).toBe(true); // became p2's
    expect(g.moods.p1!.some((m) => m.card === 5)).toBe(false);
  });

  it('#103 Thrill returns your moods to hand and grants that many extra plays', () => {
    const { e, s } = game(rig([93, 103], [5]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 93 }); // Gluttony -> +1 play
    const guid = g.moods.p1!.find((m) => m.card === 93)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 103, choices: { moods: [guid] } });
    expect(g.hands.p1!).toContain(93); // Gluttony returned to hand
    expect(g.moods.p1!.some((m) => m.card === 93)).toBe(false);
    expect(g.activePlayer).toBe('p1'); // Thrill granted an extra play -> turn continues
    expect(g.playsRemaining).toBe(1);
    g = e.apply(g, { type: 'play', player: 'p1', card: 93 }); // replay the returned Gluttony
    expect(g.moods.p1!.some((m) => m.card === 93)).toBe(true);
  });

  it('#100 Recklessness returns the taken mood and bottom-decks itself after scoring', () => {
    // p1 plays Complacency; p2 plays Recklessness taking it. After scoring it is
    // returned and Recklessness goes to the bottom of the deck (p2 draws).
    const { e, s } = game(rig([5], [100]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 5 });
    const uid = g.moods.p1![0]!.uid;
    g = e.apply(g, { type: 'play', player: 'p2', card: 100, choices: { moods: [uid] } });
    expect(g.moods.p1!.some((m) => m.card === 5)).toBe(true); // Complacency returned to p1
    expect(g.moods.p2!.some((m) => m.card === 100)).toBe(false); // Recklessness left play
    expect(g.deck[g.deck.length - 1]).toBe(100); // ...to the bottom of the deck
  });

  it('#102 Stubbornness grants an extra play at turn start while an opponent has more moods', () => {
    const { e, s } = game(rig([5], [5]));
    s.moods.p1 = [mkMood(102, 'p1')]; // p1: 1 mood (Stubbornness, [3])
    s.moods.p2 = [mkMood(5, 'p2'), mkMood(5, 'p2')]; // p2: 2 moods ([4] each)
    let g: GameState = e.apply(s, { type: 'pass', player: 'p1' });
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p2 (8) wins round 1, leads round 2
    expect(g.round).toBe(2);
    expect(g.activePlayer).toBe('p2');
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p2's round-2 turn -> p1 becomes active
    expect(g.activePlayer).toBe('p1');
    expect(g.playsRemaining).toBe(2); // p2 (2 moods) > p1 (1 mood) -> Stubbornness grants +1
  });

  it('#102 Stubbornness grants nothing when the owner is not behind on moods', () => {
    const { e, s } = game(rig([5], [5]));
    s.moods.p1 = [mkMood(102, 'p1'), mkMood(5, 'p1')]; // p1: 2 moods (worth 3 + 4 = 7)
    s.moods.p2 = [mkMood(5, 'p2')]; // p2: 1 mood (4)
    let g: GameState = e.apply(s, { type: 'pass', player: 'p1' });
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 (7) wins round 1, leads round 2
    expect(g.round).toBe(2);
    expect(g.activePlayer).toBe('p1');
    expect(g.playsRemaining).toBe(1); // not behind -> no extra play
  });
});

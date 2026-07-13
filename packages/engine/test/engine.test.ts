import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { CardDB, registerEffects } from '../src/cards/registry.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { GameState } from '../src/types.js';
import { card, riggedDeck } from './helpers.js';
import '../src/cards/index.js'; // registers known real-card effects (Glee, Love)

// ---- synthetic cards exercising each pipeline stage ----------------------
const PLAIN5 = 800; // white, fixed 5
const PLAIN2 = 801; // white, fixed 2
const DAMP = 802; // white 0, reduces other white moods by 3 (while in play)
const DISGUST6 = 803; // white 6, no effect (reducible)
const SELFLOATH = 804; // black 4, cost: discard one of your moods
const RAGE6 = 805; // red 6, after-playing: discard moods with value <= 3
const SNEAKY = 806; // blue 1, after-scoring: swap scores with opponent
const SUPPRESS = 807; // green 0, after-playing: sustained-suppress a target mood

registerEffects(DAMP, {
  whileInPlay: () => [
    { appliesTo: (m, ctx) => m.uid !== ctx.self.uid && ctx.card(m).color === 'white', op: { kind: 'add', n: -3 } },
  ],
});
registerEffects(SELFLOATH, {
  canPlay: (ctx) => ctx.moodsOf(ctx.me).length > 0,
  payCost: (ctx) => {
    const target = ctx.choices.moods?.[0];
    const mood = ctx.moodsOf(ctx.me).find((m) => m.uid === target) ?? ctx.moodsOf(ctx.me)[0];
    if (mood) ctx.discardMoodToPile(mood);
  },
});
registerEffects(RAGE6, {
  afterPlaying: (ctx) => {
    for (const m of ctx.allMoods()) if (m.uid !== ctx.self.uid && m.currentValue <= 3) ctx.discardMoodToPile(m);
  },
});
registerEffects(SNEAKY, {
  afterScoring: (ctx) => {
    const opp = ctx.opponentsOf(ctx.me)[0]!;
    const mine = ctx.state.roundScores[ctx.me] ?? 0;
    ctx.state.roundScores[ctx.me] = ctx.state.roundScores[opp] ?? 0;
    ctx.state.roundScores[opp] = mine;
  },
});
registerEffects(SUPPRESS, {
  afterPlaying: (ctx) => {
    const uid = ctx.choices.moods?.[0];
    const mood = ctx.allMoods().find((m) => m.uid === uid);
    if (mood) ctx.suppress(mood, 'sustained');
  },
});

function db() {
  return new CardDB([
    card({ number: PLAIN5, color: 'white', value: 5 }),
    card({ number: PLAIN2, color: 'white', value: 2 }),
    card({ number: DAMP, color: 'white', value: 0 }),
    card({ number: DISGUST6, color: 'white', value: 6, dieColor: 'black' }),
    card({ number: SELFLOATH, color: 'black', value: 4 }),
    card({ number: RAGE6, color: 'red', value: 6 }),
    card({ number: SNEAKY, color: 'blue', value: 1 }),
    card({ number: SUPPRESS, color: 'green', value: 0 }),
  ]);
}

const P = [
  { id: 'p1', name: 'P1' },
  { id: 'p2', name: 'P2' },
];

function game(deck: number[]) {
  const engine = new Engine(db());
  const state = engine.setup({ players: P, deck, preshuffled: true, seed: 1 });
  return { engine, state };
}

describe('scoring & rounds', () => {
  it('sums mood values; tie goes to the earlier player; winner increments', () => {
    const { engine, state } = game(riggedDeck([PLAIN5], [PLAIN5], PLAIN5));
    let s: GameState = engine.apply(state, { type: 'play', player: 'p1', card: PLAIN5 });
    s = engine.apply(s, { type: 'play', player: 'p2', card: PLAIN5 });
    // 5 vs 5 tie -> p1 (played first) wins round 1
    expect(s.players.find((p) => p.id === 'p1')!.roundsWon).toBe(1);
    expect(s.round).toBe(2);
    expect(s.firstPlayer).toBe('p1');
  });

  it('a fixed (white-die) value never changes', () => {
    const { engine, state } = game(riggedDeck([PLAIN5], [PLAIN2], PLAIN5));
    const s = engine.apply(state, { type: 'play', player: 'p1', card: PLAIN5 });
    expect(s.moods.p1![0]!.currentValue).toBe(5);
  });
});

describe('while-in-play value fixpoint', () => {
  it('Damp reduces another white mood 6 -> 3 (rulebook Patience/Disgust example)', () => {
    const { engine, state } = game(riggedDeck([DISGUST6], [DAMP], PLAIN5));
    let s = engine.apply(state, { type: 'play', player: 'p1', card: DISGUST6 });
    expect(s.moods.p1![0]!.currentValue).toBe(6);
    s = engine.apply(s, { type: 'play', player: 'p2', card: DAMP });
    expect(s.moods.p1![0]!.currentValue).toBe(3); // Disgust reduced by Damp
  });
});

describe('to-play costs', () => {
  it('Self-Loathing cannot be played with no moods, can once you have one', () => {
    // p1 hand: SELFLOATH, PLAIN5 ; p2 filler
    const { engine, state } = game(riggedDeck([SELFLOATH, PLAIN5], [PLAIN2], PLAIN2));
    expect(() => engine.apply(state, { type: 'play', player: 'p1', card: SELFLOATH })).toThrow();
    // play a mood first (as p1), pass p2, new round, then self-loathing discards it
    let s = engine.apply(state, { type: 'play', player: 'p1', card: PLAIN5 });
    s = engine.apply(s, { type: 'pass', player: 'p2' });
    expect(s.moods.p1!.length).toBe(1);
    s = engine.apply(s, { type: 'play', player: 'p1', card: SELFLOATH });
    // PLAIN5 discarded to pay cost; SELFLOATH now in play
    expect(s.discard).toContain(PLAIN5);
    expect(s.moods.p1!.map((m) => m.card)).toEqual([SELFLOATH]);
  });
});

describe('after-playing effects', () => {
  it('Rage discards all moods with value <= 3', () => {
    // p1 plays PLAIN2 (value 2) round 1; p2 passes; p1 plays RAGE6 -> discards the 2
    const { engine, state } = game(riggedDeck([PLAIN2, RAGE6], [PLAIN5], PLAIN5));
    let s = engine.apply(state, { type: 'play', player: 'p1', card: PLAIN2 });
    s = engine.apply(s, { type: 'pass', player: 'p2' });
    s = engine.apply(s, { type: 'play', player: 'p1', card: RAGE6 });
    expect(s.discard).toContain(PLAIN2);
    expect(s.moods.p1!.map((m) => m.card)).toEqual([RAGE6]);
  });
});

describe('suppression', () => {
  it('a sustained-suppressed mood scores 0 but still counts as in play', () => {
    const { engine, state } = game(riggedDeck([DISGUST6, SUPPRESS], [PLAIN2], PLAIN2));
    let s = engine.apply(state, { type: 'play', player: 'p1', card: DISGUST6 });
    const targetUid = s.moods.p1![0]!.uid;
    s = engine.apply(s, { type: 'pass', player: 'p2' });
    s = engine.apply(s, { type: 'play', player: 'p1', card: SUPPRESS, choices: { moods: [targetUid] } });
    const disgust = s.moods.p1!.find((m) => m.card === DISGUST6)!;
    expect(disgust.currentValue).toBe(0);
    expect(disgust.suppressed).toBe('sustained');
  });
});

describe('after-scoring can flip the winner (Sneakiness)', () => {
  it('swaps scores so the lower scorer wins', () => {
    // p1: PLAIN2 (2). p2: PLAIN5 (5) + SNEAKY. p2 would score 6 vs 2 but swaps.
    const { engine, state } = game(riggedDeck([PLAIN2], [PLAIN5, SNEAKY], PLAIN2));
    let s = engine.apply(state, { type: 'play', player: 'p1', card: PLAIN2 });
    s = engine.apply(s, { type: 'play', player: 'p2', card: PLAIN5 });
    // round 1: p1=2, p2=5 -> p2 wins; winner (p2) leads round 2
    expect(s.players.find((p) => p.id === 'p2')!.roundsWon).toBe(1);
    expect(s.firstPlayer).toBe('p2');
    // round 2: p2 plays SNEAKY first, then p1 passes. Scores p1=2, p2=6 ->
    // swap -> p1=6, p2=2 -> p1 wins the round.
    s = engine.apply(s, { type: 'play', player: 'p2', card: SNEAKY });
    s = engine.apply(s, { type: 'pass', player: 'p1' });
    expect(s.players.find((p) => p.id === 'p1')!.roundsWon).toBe(1);
  });
});

describe('game ends at 3 round wins', () => {
  it('p1 wins three ties in a row', () => {
    const engine = new Engine(db());
    let s = engine.setup({ players: P, deck: Array(60).fill(PLAIN5), preshuffled: true });
    for (let r = 0; r < 3; r++) {
      s = engine.apply(s, { type: 'play', player: 'p1', card: PLAIN5 });
      s = engine.apply(s, { type: 'pass', player: 'p2' });
    }
    expect(s.winner).toBe('p1');
    expect(s.phase).toBe('gameOver');
  });
});

// ---- real card data ------------------------------------------------------
describe('real cards from data/cards.json', () => {
  let realDb: CardDB;
  beforeAll(() => {
    const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
    const raw = JSON.parse(readFileSync(path, 'utf8')) as RawCard[];
    realDb = loadCardDB(raw);
  });

  it('loads all 135 cards', () => {
    expect(realDb.size).toBe(135);
  });

  it('Glee (#92) is worth 6 the round it is played, 0 afterwards', () => {
    const engine = new Engine(realDb);
    // Give p1 two Glees so it can be replayed in a later round.
    let s = engine.setup({ players: P, deck: [92, 92, 92, 92, 92, 92, 92, 92, 92, 92, 92, 92], preshuffled: true });
    s = engine.apply(s, { type: 'play', player: 'p1', card: 92 });
    expect(s.moods.p1![0]!.currentValue).toBe(6); // played this round
    s = engine.apply(s, { type: 'pass', player: 'p2' });
    // round 2 now; the earlier Glee is no longer "this round"
    expect(s.moods.p1![0]!.currentValue).toBe(0);
  });

  it('Love (#134) is 12 with all five colours in play, else 4', () => {
    const engine = new Engine(realDb);
    const s = engine.setup({ players: P, deck: Array(30).fill(5), preshuffled: true });
    // Directly place a board of moods and stabilise (isolates the value logic
    // from the round loop). Vanillas: white 5, blue 44, black 55, red 83; Love 134 is green.
    const mk = (cardN: number, uid: string) =>
      ({ uid, card: cardN, owner: 'p1', stolenFrom: null, usingSecondary: false,
        suppressed: 'none', suppressedBy: null, copyOf: null, currentValue: 0, data: {} }) as const;

    s.moods.p1 = [mk(5, 'a'), mk(44, 'b'), mk(55, 'c'), mk(83, 'd'), mk(134, 'e')];
    s.moods.p2 = [];
    engine.stabilise(s);
    expect(s.moods.p1!.find((m) => m.card === 134)!.currentValue).toBe(12);

    // Remove the white mood -> only four colours -> Love falls back to 4.
    s.moods.p1 = [mk(44, 'b'), mk(55, 'c'), mk(83, 'd'), mk(134, 'e')];
    engine.stabilise(s);
    expect(s.moods.p1!.find((m) => m.card === 134)!.currentValue).toBe(4);
  });

  it('a no-text vanilla card scores its printed value', () => {
    const engine = new Engine(realDb);
    let s = engine.setup({ players: P, deck: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], preshuffled: true });
    s = engine.apply(s, { type: 'play', player: 'p1', card: 5 }); // Complacency (white, no text)
    const printed = realDb.get(5).value;
    expect(s.moods.p1![0]!.currentValue).toBe(printed);
  });
});

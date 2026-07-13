import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { CardDB } from '../src/cards/registry.js';
import type { GameState, Mood, PlayerId } from '../src/types.js';
import '../src/cards/green.js';
import '../src/cards/blue.js'; // Fear #38 (used to bounce Hope out of play)

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const db: CardDB = loadCardDB(JSON.parse(readFileSync(path, 'utf8')) as RawCard[]);
const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];

/** Deck rigged so p1's hand = first 5, p2's = next 5. Filler = green vanilla #126. */
function rig(p1: number[], p2: number[], filler = 126): number[] {
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
    uid: `t${uid++}`,
    card,
    owner,
    stolenFrom: null,
    usingSecondary: false,
    suppressed: 'none',
    suppressedBy: null,
    copyOf: null,
    currentValue: 0,
    data: {},
  };
}

// Vanilla one-per-colour (value 4, no effects): white 5, blue 44, black 55, red 83, green 126.

describe('green cards', () => {
  it('#134 Love is [12] with all five colours in play, else [4]', () => {
    const { e, s } = game(rig([134], [126]));
    const love = mkMood(134, 'p1');
    s.moods.p1 = [love, mkMood(5, 'p1'), mkMood(44, 'p1'), mkMood(55, 'p1'), mkMood(83, 'p1')];
    e.stabilise(s);
    expect(love.currentValue).toBe(12); // white+blue+black+red+green all present
    s.moods.p1 = [love, mkMood(5, 'p1'), mkMood(44, 'p1'), mkMood(55, 'p1')]; // drop red
    e.stabilise(s);
    expect(love.currentValue).toBe(4);
  });

  it('#127 Love (mythic) matches the #134 headliner rule', () => {
    const { e, s } = game(rig([127], [126]));
    const love = mkMood(127, 'p1');
    s.moods.p1 = [love];
    s.moods.p2 = [mkMood(5, 'p2'), mkMood(44, 'p2'), mkMood(55, 'p2'), mkMood(83, 'p2')];
    e.stabilise(s);
    expect(love.currentValue).toBe(12); // five colours split across players still count
  });

  it('#117 Euphoria equals the number of moods in play', () => {
    const { e, s } = game(rig([117], [126]));
    const euph = mkMood(117, 'p1');
    s.moods.p1 = [euph, mkMood(126, 'p1')];
    s.moods.p2 = [mkMood(5, 'p2')];
    e.stabilise(s);
    expect(euph.currentValue).toBe(3); // three moods total
  });

  it('#112 Determination is [6] once three moods share a colour, else [3]', () => {
    const { e, s } = game(rig([112], [126]));
    const det = mkMood(112, 'p1');
    s.moods.p1 = [det, mkMood(126, 'p1')]; // two greens
    e.stabilise(s);
    expect(det.currentValue).toBe(3);
    s.moods.p1 = [det, mkMood(126, 'p1'), mkMood(126, 'p1')]; // three greens
    e.stabilise(s);
    expect(det.currentValue).toBe(6);
  });

  it('#130 Sloth is [3] plus the number of cards in your hand', () => {
    const { e, s } = game(rig([130], [126]));
    const sloth = mkMood(130, 'p1');
    s.moods.p1 = [sloth];
    s.hands.p1 = [126, 126, 126]; // three cards
    e.stabilise(s);
    expect(sloth.currentValue).toBe(6); // 3 + 3
  });

  it('#132 Vulnerability is [7] once a card is in the discard pile (discard-count)', () => {
    const { e, s } = game(rig([132], [126]));
    const vuln = mkMood(132, 'p1');
    s.moods.p1 = [vuln];
    s.discard = [];
    e.stabilise(s);
    expect(vuln.currentValue).toBe(1);
    s.discard = [55]; // something got discarded
    e.stabilise(s);
    expect(vuln.currentValue).toBe(7);
  });

  it('#110 Cheer becomes [5] when you discard a printed [0]/[2]/[4]/[6] hand card', () => {
    // p1 hand: Cheer(110), Complacency(5, printed [4]). Discard it -> Cheer is [5].
    const { e, s } = game(rig([110, 5], [126]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 110, choices: { cards: [5] } });
    const cheer = g.moods.p1!.find((m) => m.card === 110)!;
    expect(cheer.currentValue).toBe(5);
    expect(g.discard).toContain(5); // Complacency was discarded
    // Without the discard choice it stays [3].
    const g2 = game(rig([110, 125], [126]));
    const x = g2.e.apply(g2.s, { type: 'play', player: 'p1', card: 110 });
    expect(x.moods.p1!.find((m) => m.card === 110)!.currentValue).toBe(3);
  });

  it('#128 Nostalgia pulls a discard card to hand and grants an extra play', () => {
    const { e, s } = game(rig([128, 126], [126]));
    s.discard = [83]; // a red card sits in the discard pile
    const g = e.apply(s, { type: 'play', player: 'p1', card: 128, choices: { cards: [83] } });
    expect(g.discard).not.toContain(83);
    expect(g.hands.p1).toContain(83); // moved into hand
    expect(g.activePlayer).toBe('p1'); // extra play granted -> still p1's turn
  });

  it('#108 Bliss scores same-colour moods twice extra, swinging the round', () => {
    // p1 plays Bliss(2, green), discarding green Laziness -> Bliss (green) scores
    // 2 extra times: 2 + 2*2 = 6. p2 plays Complacency(4). Without the extra
    // scoring p1 (2) would lose to p2 (4); with it p1 (6) wins.
    const { e, s } = game(rig([108, 126], [5]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 108, choices: { cards: [126] } });
    expect(g.activePlayer).toBe('p2');
    g = e.apply(g, { type: 'play', player: 'p2', card: 5 });
    expect(g.players.find((p) => p.id === 'p1')!.roundsWon).toBe(1); // Bliss extra scoring won it
  });

  it('#122 Happiness is [8] when one player holds both a red and a white mood', () => {
    const { e, s } = game(rig([122], [126]));
    const hap = mkMood(122, 'p1');
    s.moods.p1 = [hap, mkMood(83, 'p1')]; // green Happiness + red
    e.stabilise(s);
    expect(hap.currentValue).toBe(2); // no single player has red AND white yet
    s.moods.p1 = [hap, mkMood(83, 'p1'), mkMood(5, 'p1')]; // add white to same player
    e.stabilise(s);
    expect(hap.currentValue).toBe(8);
  });

  // ---- F1: future-turn / recurring "additional mood" grants -----------------

  it('#125 Joy grants exactly one extra play on the owner\'s NEXT turn, not this turn', () => {
    // p1 hand: Joy(125) + fillers. Joy is [3]; p2 passes so p1 (3) wins round 1
    // and leads round 2, giving us a clean look at p1's next turn.
    const { e, s } = game(rig([125], [126]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 125 });
    // Joy grants only on the NEXT turn — this turn ends immediately (no extra play now).
    expect(g.activePlayer).toBe('p2');
    expect(g.pendingExtraPlays.p1).toBe(1); // queued for p1's next turn
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 (Joy [3]) wins round 1, leads round 2
    expect(g.round).toBe(2);
    expect(g.activePlayer).toBe('p1');
    expect(g.playsRemaining).toBe(2); // base 1 + Joy's one-time grant
    expect(g.pendingExtraPlays.p1).toBe(0); // consumed
    // The extra play lets p1 play two moods this turn.
    g = e.apply(g, { type: 'play', player: 'p1', card: 126 });
    expect(g.activePlayer).toBe('p1'); // second play still available
    g = e.apply(g, { type: 'play', player: 'p1', card: 126 });
    expect(g.activePlayer).toBe('p2'); // both plays used, turn ends — grant was one-time
  });

  it('#120 Generosity grants the CHOSEN opponent an extra play on their next turn', () => {
    // p1 plays Generosity([6]) choosing p2; p2's very next turn (same round) gets +1 play.
    const { e, s } = game(rig([120], [126, 126, 126]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 120, choices: { players: ['p2'] } });
    expect(g.activePlayer).toBe('p2');
    expect(g.playsRemaining).toBe(2); // Generosity gave p2 a second play at their turn start
    expect(g.pendingExtraPlays.p2).toBe(0); // consumed
    g = e.apply(g, { type: 'play', player: 'p2', card: 126 });
    expect(g.activePlayer).toBe('p2'); // the extra play keeps p2's turn going
    expect(g.playsRemaining).toBe(1);
  });

  it('#124 Hope grants an extra play EACH of the owner\'s turns while in play, and stops once it leaves', () => {
    // Round 1: p1 plays Hope (its own-turn grant keeps the turn alive) then a filler.
    const { e, s } = game(rig([124, 126, 38], [126]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 124 });
    expect(g.activePlayer).toBe('p1'); // Hope's "including the turn you play it" grant
    expect(g.playsRemaining).toBe(1);
    g = e.apply(g, { type: 'play', player: 'p1', card: 126 }); // spend the extra play
    expect(g.activePlayer).toBe('p2');
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 (moods worth 4) wins round 1, leads round 2
    expect(g.round).toBe(2);
    expect(g.activePlayer).toBe('p1');
    expect(g.playsRemaining).toBe(2); // recurring: Hope grants +1 at the start of each of p1's turns
    // p1 bounces Hope back to hand with Fear #38, then passes to end the turn.
    const hopeUid = g.moods.p1!.find((m) => m.card === 124)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 38, choices: { moods: [hopeUid] } });
    expect(g.hands.p1).toContain(124); // Hope left play
    expect(g.moods.p1!.some((m) => m.card === 124)).toBe(false);
    g = e.apply(g, { type: 'pass', player: 'p1' }); // decline remaining plays, end turn
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 still wins, leads round 3
    expect(g.round).toBe(3);
    expect(g.activePlayer).toBe('p1');
    expect(g.playsRemaining).toBe(1); // Hope gone -> recurring grant stops
  });

  it('#121 Grace grants a recurring discard play each of the owner\'s turns while in play', () => {
    // A red mood sits in the discard pile to be replayed from it.
    const { e, s } = game(rig([121, 126], [126]));
    s.discard = [83];
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 121 });
    expect(g.discardPlaysRemaining).toBe(1); // Grace's own-turn discard grant
    expect(g.activePlayer).toBe('p1'); // an available discard play keeps the turn alive
    // Play the discard mood using the granted discard play.
    g = e.apply(g, { type: 'play', player: 'p1', card: 83, from: 'discard' });
    expect(g.moods.p1!.some((m) => m.card === 83)).toBe(true);
    expect(g.discard).not.toContain(83);
    expect(g.discardPlaysRemaining).toBe(0);
    expect(g.activePlayer).toBe('p2'); // no plays left, turn ends
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 (Grace 0 + red 4) wins round 1, leads round 2
    expect(g.round).toBe(2);
    expect(g.activePlayer).toBe('p1');
    expect(g.discardPlaysRemaining).toBe(1); // recurring: Grace re-grants a discard play at turn start
  });
});

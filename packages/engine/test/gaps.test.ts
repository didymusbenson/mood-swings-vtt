// Tests for the second wave of closed effect-gaps: colour-matched extra plays
// (Eagerness #114, Grace covered in green.test), the extra-scoring hook (Enthusiasm
// #116, Exhilaration #89, Passion #97; Bliss #108 covered in green.test), Awe #107
// no-scoring, Corruption #60 double-win, Doubt #36 colour play-gate, and Arrogance
// #82 leave-play give-back. See docs/effect-gaps.md.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { CardDB } from '../src/cards/registry.js';
import type { GameState, Mood, PlayerId } from '../src/types.js';
import '../src/cards/white.js';
import '../src/cards/blue.js';
import '../src/cards/black.js';
import '../src/cards/red.js';
import '../src/cards/green.js';

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const db: CardDB = loadCardDB(JSON.parse(readFileSync(path, 'utf8')) as RawCard[]);
const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];

/** Deck rigged so p1's hand = first 5, p2's = next 5. Filler = green vanilla #126. */
function rig(p1: number[], p2: number[], filler = 126): number[] {
  const pad = (h: number[]) => [...h, ...Array(5).fill(filler)].slice(0, 5);
  return [...pad(p1), ...pad(p2), ...Array(40).fill(filler)];
}
const game = (deck: number[], firstPlayer?: PlayerId) => {
  const e = new Engine(db);
  return { e, s: e.setup({ players: P, deck, preshuffled: true, firstPlayer }) };
};

let uid = 0;
function mkMood(card: number, owner: PlayerId): Mood {
  return {
    uid: `t${uid++}`, card, owner, stolenFrom: null, usingSecondary: false,
    suppressed: 'none', suppressedBy: null, copyOf: null, currentValue: 0, data: {},
  };
}
/** The last "Scoring — …" log line, which reflects extra-scoring contributions. */
const scoreLine = (g: GameState) => g.log.filter((l) => l.kind === 'score').pop()!.message;

describe('effect-gap closures', () => {
  // ---- colour-matched extra plays ------------------------------------------
  it('#114 Eagerness grants a colour-matched extra play (green ok, off-colour refused)', () => {
    const { e, s } = game(rig([114, 126, 5], [126])); // Eagerness(green), green, white
    const g = e.apply(s, { type: 'play', player: 'p1', card: 114 });
    expect(g.activePlayer).toBe('p1'); // conditional extra play keeps the turn alive
    // White #5 shares no colour with Eagerness (green) → its grant can't be spent on it.
    expect(() => e.apply(g, { type: 'play', player: 'p1', card: 5 })).toThrow();
    // A green card matches → allowed, and consumes the one-time grant.
    const g2 = e.apply(g, { type: 'play', player: 'p1', card: 126 });
    expect(g2.moods.p1!.some((m) => m.card === 126)).toBe(true);
    expect(g2.activePlayer).toBe('p2'); // grant used up, turn ends
  });

  // ---- extra-scoring hook ---------------------------------------------------
  it('#116 Enthusiasm scores the owner\'s best mood an extra time', () => {
    const { e, s } = game(rig([126], [126]));
    s.moods.p1 = [mkMood(116, 'p1'), mkMood(126, 'p1')]; // Enthusiasm[0] + green[4]
    s.moods.p2 = [mkMood(126, 'p2')]; // [4]
    let g = e.apply(s, { type: 'pass', player: 'p1' });
    g = e.apply(g, { type: 'pass', player: 'p2' });
    expect(scoreLine(g)).toContain('P1 8'); // base 4 + best own mood 4
  });

  it('#89 Exhilaration scores all the owner\'s moods an extra time', () => {
    const { e, s } = game(rig([126], [126]));
    s.moods.p1 = [mkMood(89, 'p1'), mkMood(126, 'p1'), mkMood(126, 'p1')]; // Exhil[0] + two [4]
    s.moods.p2 = [mkMood(126, 'p2')];
    let g = e.apply(s, { type: 'pass', player: 'p1' });
    g = e.apply(g, { type: 'pass', player: 'p2' });
    expect(scoreLine(g)).toContain('P1 16'); // base 8 + (0+4+4) extra
  });

  it('#97 Passion scores an opponent\'s mood as yours; they still score it', () => {
    const { e, s } = game(rig([126], [126]));
    s.moods.p1 = [mkMood(97, 'p1'), mkMood(126, 'p1')]; // Passion[0] + [4]
    s.moods.p2 = [mkMood(126, 'p2')]; // [4]
    let g = e.apply(s, { type: 'pass', player: 'p1' });
    g = e.apply(g, { type: 'pass', player: 'p2' });
    expect(scoreLine(g)).toContain('P1 8'); // base 4 + opponent's best mood 4
    expect(scoreLine(g)).toContain('P2 4'); // opponent still scores it normally
  });

  // ---- Awe #107 -------------------------------------------------------------
  it('#107 Awe cancels this round\'s scoring — no winner, no loser draw, chosen leader next', () => {
    const { e, s } = game(rig([107], [126]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 107, choices: { players: ['p2'] } });
    expect(g.activePlayer).toBe('p2'); // Awe [4], single play, turn ends
    const p2Hand = g.hands.p2!.length;
    g = e.apply(g, { type: 'pass', player: 'p2' });
    expect(g.players.find((p) => p.id === 'p1')!.roundsWon).toBe(0); // nobody wins
    expect(g.players.find((p) => p.id === 'p2')!.roundsWon).toBe(0);
    expect(g.round).toBe(2);
    expect(g.activePlayer).toBe('p2'); // Awe's chosen next leader
    expect(g.hands.p2!.length).toBe(p2Hand); // no loser draw
  });

  // ---- Corruption #60 -------------------------------------------------------
  it('#60 Corruption (wins mode) makes the round winner win two rounds', () => {
    const { e, s } = game(rig([60], [126]));
    let g = e.apply(s, { type: 'play', player: 'p1', card: 60, choices: { option: 'wins' } });
    expect(g.activePlayer).toBe('p2');
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 (Corruption [2]) wins the round
    expect(g.players.find((p) => p.id === 'p1')!.roundsWon).toBe(2); // double win
    expect(g.round).toBe(2);
  });

  // ---- Doubt #36 ------------------------------------------------------------
  it('#36 Doubt bans the revealed cards\' colour for the next round only', () => {
    const { e, s } = game(rig([36, 83], [126])); // Doubt + a red card to reveal
    let g = e.apply(s, { type: 'play', player: 'p1', card: 36, choices: { cards: [83] } });
    expect(g.pendingBannedColors).toContain('red');
    expect(g.bannedColors).not.toContain('red'); // staged, not yet active
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 (Doubt [2]) wins round 1, leads round 2
    expect(g.round).toBe(2);
    expect(g.bannedColors).toContain('red'); // active this round
    g.hands.p1 = [83];
    expect(() => e.apply(g, { type: 'play', player: 'p1', card: 83 })).toThrow(); // red rejected
    g.hands.p1 = [126];
    const ok = e.apply(g, { type: 'play', player: 'p1', card: 126 }); // non-banned colour is fine
    expect(ok.moods.p1!.some((m) => m.card === 126)).toBe(true);
  });

  // ---- Arrogance #82 --------------------------------------------------------
  it('#82 Arrogance returns the taken mood to its owner when it leaves play', () => {
    // p2 leads and plays a white mood; p1 takes it with Arrogance; next round p1
    // bounces Arrogance to hand (Fear #38) and the white mood goes back to p2.
    const { e, s } = game(rig([82, 38], [5]), 'p2');
    let g = e.apply(s, { type: 'play', player: 'p2', card: 5 }); // white Complacency
    const whiteUid = g.moods.p2!.find((m) => m.card === 5)!.uid;
    expect(g.activePlayer).toBe('p1');
    g = e.apply(g, { type: 'play', player: 'p1', card: 82, choices: { moods: [whiteUid] } });
    expect(g.moods.p1!.some((m) => m.card === 5)).toBe(true); // taken
    expect(g.moods.p2!.some((m) => m.card === 5)).toBe(false);
    expect(g.round).toBe(2); // p1 (2 + 4) won round 1, leads round 2
    const arrUid = g.moods.p1!.find((m) => m.card === 82)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 38, choices: { moods: [arrUid] } });
    expect(g.hands.p1).toContain(82); // Arrogance left play (bounced to hand)
    expect(g.moods.p2!.some((m) => m.card === 5)).toBe(true); // white mood returned
    expect(g.moods.p1!.some((m) => m.card === 5)).toBe(false);
  });
});

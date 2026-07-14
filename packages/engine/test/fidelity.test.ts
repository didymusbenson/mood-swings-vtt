// Regression tests for the rules-fidelity audit fixes (RULES.md + card-notes.md):
//   1. sustained suppression lifts when the suppressor leaves play (Meekness #19)
//   2. Sneakiness #51 swaps scores only the round it was played
//   3. Hostility #94 re-settles values between its two sub-effects (RULES.md example)
//   4. Bashfulness #30 self-bottom-decks only on the round it was played
//   5. Instability #96 takes the CHOSEN opponent mood (no auto-pick of the lower)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Engine } from '../src/engine.js';
import { loadCardDB, type RawCard } from '../src/data.js';
import type { CardDB } from '../src/cards/registry.js';
import type { GameState, Mood, PlayerId } from '../src/types.js';
import '../src/cards/index.js';

const path = fileURLToPath(new URL('../../../data/cards.json', import.meta.url));
const db: CardDB = loadCardDB(JSON.parse(readFileSync(path, 'utf8')) as RawCard[]);
const P = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];

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

describe('rules-fidelity fixes', () => {
  it('#19 Meekness — sustained suppression lifts when Meekness leaves play', () => {
    // p2 has a Sloth (#130 = 3 + hand) worth [6]; p1 plays Meekness (suppresses ≥[5]),
    // then next round discards Meekness (via Bravado #84) — the Sloth must revert.
    const { e, s } = game(rig([19, 84], [126]));
    s.moods.p2 = [mkMood(130, 'p2')];
    s.hands.p2 = [126, 126, 126]; // Sloth = 3 + 3 = 6
    e.stabilise(s);
    expect(s.moods.p2![0]!.currentValue).toBe(6);

    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 19 }); // Meekness
    const sloth = (st: GameState) => st.moods.p2!.find((m) => m.card === 130)!;
    expect(sloth(g).suppressed).toBe('sustained');
    expect(sloth(g).currentValue).toBe(0); // suppressed
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p1 (Meekness [1]) wins round 1, leads round 2
    expect(g.round).toBe(2);
    expect(sloth(g).suppressed).toBe('sustained'); // still suppressed across the round boundary
    const meekUid = g.moods.p1!.find((m) => m.card === 19)!.uid;
    g = e.apply(g, { type: 'play', player: 'p1', card: 84, choices: { moods: [meekUid] } }); // Bravado discards Meekness
    expect(g.moods.p1!.some((m) => m.card === 19)).toBe(false); // Meekness left play
    expect(sloth(g).suppressed).toBe('none'); // suppression lifted
    expect(sloth(g).currentValue).toBeGreaterThanOrEqual(6); // value reverted
  });

  it('#51 Sneakiness — swaps scores only the round it was played', () => {
    const { e, s } = game(rig([51], [126]));
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 51, choices: { players: ['p2'] } });
    g = e.apply(g, { type: 'pass', player: 'p2' }); // round 1: raw p1=5,p2=0 → swap → p2 wins
    expect(g.players.find((p) => p.id === 'p2')!.roundsWon).toBe(1);
    expect(g.round).toBe(2);
    // Round 2: Sneakiness still in play but must NOT swap again.
    g = e.apply(g, { type: 'pass', player: 'p2' }); // p2 leads round 2
    g = e.apply(g, { type: 'pass', player: 'p1' });
    // p1 (Sneakiness [5]) = 5, p2 = 0; no swap → p1 wins round 2.
    expect(g.players.find((p) => p.id === 'p1')!.roundsWon).toBe(1);
    expect(g.players.find((p) => p.id === 'p2')!.roundsWon).toBe(1);
  });

  it('#94 Hostility — re-settles values between sacrifice and the value-gated second effect', () => {
    // Discipline #9 is [3] while 2+ black/red moods are in play, else [6]. Board:
    // Discipline + a black Apathy; Hostility (red) enters → 2 black/red → Discipline [3].
    // Hostility sacrifices the black Apathy → 1 black/red → Discipline re-settles to [6],
    // so the second effect ("moods ≤[3]") must NOT be able to discard it.
    const { e, s } = game(rig([94], [126]));
    s.moods.p1 = [mkMood(9, 'p1'), mkMood(55, 'p1')]; // Discipline + Apathy(black)
    e.stabilise(s);
    const apathyUid = s.moods.p1!.find((m) => m.card === 55)!.uid;
    const discUid = s.moods.p1!.find((m) => m.card === 9)!.uid;
    const g: GameState = e.apply(s, {
      type: 'play', player: 'p1', card: 94, choices: { moods: [apathyUid, discUid] },
    });
    expect(g.discard).toContain(55); // Apathy was sacrificed
    const disc = g.moods.p1!.find((m) => m.card === 9);
    expect(disc).toBeTruthy(); // Discipline survived — it re-settled to [6], above the ≤[3] gate
    expect(disc!.currentValue).toBe(6);
  });

  it('#30 Bashfulness — self-bottom-decks on the round played, not a later winning round', () => {
    // Bashfulness [6] loses round 1 to a big Sloth, so it stays in play; then p1 wins
    // round 2 — Bashfulness must NOT bottom-deck itself (that only happens the turn played).
    const { e, s } = game(rig([30, 9], [126]));
    s.moods.p2 = [mkMood(130, 'p2')]; // Sloth
    s.hands.p2 = [126, 126, 126, 126, 126]; // Sloth = 3 + 5 = 8 > Bashfulness [6]
    e.stabilise(s);
    let g: GameState = e.apply(s, { type: 'play', player: 'p1', card: 30 }); // Bashfulness
    g = e.apply(g, { type: 'pass', player: 'p2' }); // round 1: p1=6 < p2 Sloth 8 → p2 wins
    expect(g.players.find((p) => p.id === 'p2')!.roundsWon).toBe(1);
    expect(g.moods.p1!.some((m) => m.card === 30)).toBe(true); // Bashfulness survived round 1
    // Round 2: p2 leads and passes; p1 plays Discipline [6] → p1 (6+6=12) beats Sloth (8).
    g = e.apply(g, { type: 'pass', player: 'p2' });
    g = e.apply(g, { type: 'play', player: 'p1', card: 9 });
    expect(g.players.find((p) => p.id === 'p1')!.roundsWon).toBe(1); // p1 won round 2
    expect(g.moods.p1!.some((m) => m.card === 30)).toBe(true); // gated: NOT bottom-decked
  });

  it('#96 Instability — takes the chosen opponent mood (not an auto-picked lower one)', () => {
    // p2 has a [6] Discipline and a [4] vanilla. p1 explicitly takes the [6] Discipline —
    // proving the transfer follows the choice, not an auto-pick of the lower-value mood.
    const { e, s } = game(rig([96], [126]));
    s.moods.p1 = [mkMood(126, 'p1')]; // p1's give-back mood
    s.moods.p2 = [mkMood(9, 'p2'), mkMood(126, 'p2')]; // Discipline([6]) + vanilla([4])
    e.stabilise(s);
    const disc = s.moods.p2!.find((m) => m.card === 9)!;
    expect(disc.currentValue).toBe(6);
    const giveBack = s.moods.p1![0]!.uid;
    const g: GameState = e.apply(s, {
      type: 'play', player: 'p1', card: 96, choices: { moods: [disc.uid, giveBack] },
    });
    expect(g.moods.p1!.some((m) => m.uid === disc.uid)).toBe(true); // took the [6] Discipline
    expect(g.moods.p2!.some((m) => m.uid === disc.uid)).toBe(false);
    expect(g.moods.p2!.some((m) => m.card === 126)).toBe(true); // received p1's give-back
  });
});

import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine.js';
import { CardDB } from '../src/cards/registry.js';
import { redactFor, isHidden, HIDDEN, PUBLIC_MOOD_DATA_KEYS } from '../src/redact.js';
import type { GameState } from '../src/types.js';
import { card, riggedDeck } from './helpers.js';

const A = 810; // white 5
const B = 811; // white 2

function game(deck: number[]) {
  const db = new CardDB([
    card({ number: A, color: 'white', value: 5 }),
    card({ number: B, color: 'white', value: 2 }),
  ]);
  const engine = new Engine(db);
  const state = engine.setup({
    players: [
      { id: 'p1', name: 'Ada' },
      { id: 'p2', name: 'Bo' },
    ],
    deck,
    preshuffled: true,
    seed: 42,
  });
  return { engine, state };
}

describe('redactFor', () => {
  it("keeps the viewer's own hand and blanks every opponent hand to same-length HIDDEN", () => {
    const { state } = game(riggedDeck([A, A, B], [B, B, A, A], A));
    const p1View = redactFor(state, 'p1');

    expect(p1View.hands.p1).toEqual(state.hands.p1); // own hand verbatim
    expect(p1View.hands.p2).toHaveLength(state.hands.p2.length); // size preserved
    expect(p1View.hands.p2.every(isHidden)).toBe(true); // identities gone
    expect(p1View.hands.p2).not.toContain(B); // no real card leaks

    const p2View = redactFor(state, 'p2');
    expect(p2View.hands.p2).toEqual(state.hands.p2);
    expect(p2View.hands.p1.every(isHidden)).toBe(true);
  });

  it('strips deck order but preserves deck size', () => {
    const { state } = game(riggedDeck([A], [B], A));
    const view = redactFor(state, 'p1');
    expect(view.deck).toHaveLength(state.deck.length);
    expect(view.deck.every(isHidden)).toBe(true);
    expect(view.deck).not.toEqual(state.deck);
  });

  it('zeroes the RNG seed (it predicts every future draw)', () => {
    const { state } = game(riggedDeck([A], [B], A));
    expect(state.seed).not.toBe(0);
    expect(redactFor(state, 'p1').seed).toBe(0);
    expect(redactFor(state, 'p2').seed).toBe(0);
  });

  it("drops next-round's staged colour ban (Doubt #36 secret)", () => {
    const { state } = game(riggedDeck([A], [B], A));
    state.pendingBannedColors = ['red', 'blue'];
    expect(redactFor(state, 'p1').pendingBannedColors).toEqual([]);
  });

  it('rewrites log lines private to another player to their public redacted text', () => {
    const { state } = game(riggedDeck([A], [B], A));
    state.log.push({ round: 1, message: 'Ada drew Anger', private: 'p1', redacted: 'Ada drew a card' });
    state.log.push({ round: 1, message: 'A public event', kind: 'info' });

    const p2View = redactFor(state, 'p2');
    const secret = p2View.log.find((e) => e.message === 'Ada drew a card');
    expect(secret).toBeTruthy();
    expect(p2View.log.some((e) => e.message === 'Ada drew Anger')).toBe(false); // hidden text gone
    expect(secret!.private).toBeUndefined(); // markers scrubbed so nothing can recover it
    expect(secret!.redacted).toBeUndefined();
    expect(p2View.log.some((e) => e.message === 'A public event')).toBe(true); // public survives

    const p1View = redactFor(state, 'p1');
    expect(p1View.log.some((e) => e.message === 'Ada drew Anger')).toBe(true); // owner still sees it
  });

  it('passes public board/flow fields through untouched', () => {
    const { engine, state } = game(riggedDeck([A], [B], A));
    const s: GameState = engine.apply(state, { type: 'play', player: 'p1', card: A });
    const view = redactFor(s, 'p2');

    expect(view.moods).toEqual(s.moods); // moods are public
    expect(view.discard).toEqual(s.discard);
    expect(view.roundScores).toEqual(s.roundScores);
    expect(view.bannedColors).toEqual(s.bannedColors);
    expect(view.activePlayer).toBe(s.activePlayer);
    expect(view.phase).toBe(s.phase);
    expect(view.round).toBe(s.round);
    expect(view.players).toEqual(s.players);
    expect(view.turnOrder).toEqual(s.turnOrder);
    expect(view.playedThisTurn).toEqual(s.playedThisTurn);
  });

  it('never mutates the source state', () => {
    const { state } = game(riggedDeck([A, B], [B, A], A));
    const before = structuredClone(state);
    redactFor(state, 'p1');
    expect(state).toEqual(before);
  });

  it('produces a JSON-safe view (survives a DataChannel round-trip)', () => {
    const { engine, state } = game(riggedDeck([A], [B], A));
    const s = engine.apply(state, { type: 'play', player: 'p1', card: A });
    const view = redactFor(s, 'p2');
    const roundTripped = JSON.parse(JSON.stringify(view));
    expect(roundTripped).toEqual(view); // no undefined/Map/Set/functions survive-loss
    expect(HIDDEN).toBe(-1); // and the sentinel survives JSON
  });

  it('guards against a card stashing hidden info in Mood.data (allowlist)', () => {
    const { engine, state } = game(riggedDeck([A], [B], A));
    const s = engine.apply(state, { type: 'play', player: 'p1', card: A });
    for (const moods of Object.values(s.moods)) {
      for (const m of moods) {
        for (const key of Object.keys(m.data)) {
          expect(
            PUBLIC_MOOD_DATA_KEYS,
            `Mood.data key "${key}" is not on the public allowlist — redactFor must scrub it before it leaks over the wire`,
          ).toContain(key);
        }
      }
    }
  });
});

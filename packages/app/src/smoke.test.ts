import { describe, expect, it } from 'vitest';
import { Engine, validateCustomDeck } from '@mood-swings/engine';
import { db, RAW_CARDS } from './game/db.js';

describe('app <-> engine wiring', () => {
  it('loads the full card database from data/cards.json', () => {
    expect(RAW_CARDS.length).toBe(135);
    expect(db.size).toBe(135);
    expect(db.get(1).name).toBe('Altruism');
  });

  it('sets up and plays a couple of turns without throwing', () => {
    const engine = new Engine(db);
    // A small custom deck; preshuffled so hands are deterministic (top 5 -> p1,
    // next 5 -> p2). These are all no-cost value cards, safe to play blind.
    const deck = [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50];
    expect(validateCustomDeck(deck, 2).ok).toBe(true);

    let state = engine.setup({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
      deck,
      firstPlayer: 'p1',
      preshuffled: true,
    });

    expect(state.phase).toBe('awaitingPlay');
    expect(state.hands.p1).toHaveLength(5);
    expect(state.hands.p2).toHaveLength(5);

    // p1 plays Complacency (#5) — a vanilla no-effect card in p1's hand, so the
    // turn cleanly ends (cards like Charity would grant an extra play instead).
    expect(state.hands.p1).toContain(5);
    state = engine.apply(state, { type: 'play', player: 'p1', card: 5 });
    expect(state.moods.p1).toHaveLength(1);
    expect(state.activePlayer).toBe('p2');

    // p2 passes -> round completes, scoring resolves, new round begins (or game over).
    state = engine.apply(state, { type: 'pass', player: 'p2' });
    expect(['awaitingPlay', 'gameOver']).toContain(state.phase);
    expect(state.log.length).toBeGreaterThan(0);
  });

  it('surfaces illegal actions as thrown errors (caught by the UI)', () => {
    const engine = new Engine(db);
    const deck = [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50];
    const state = engine.setup({
      players: [
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ],
      deck,
      firstPlayer: 'p1',
      preshuffled: true,
    });
    // Not p2's turn -> engine throws; App wraps this in a dismissible toast.
    expect(() => engine.apply(state, { type: 'pass', player: 'p2' })).toThrow();
  });
});

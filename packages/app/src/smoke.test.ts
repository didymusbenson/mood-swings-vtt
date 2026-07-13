import { describe, expect, it } from 'vitest';
import {
  Engine,
  validateCustomDeck,
  specFor,
  legalTargets,
  isSingleTarget,
  playsImmediately,
  type Choices,
  type ChoiceSlot,
  type GameState,
} from '@mood-swings/engine';
import { db, RAW_CARDS } from './game/db.js';

const lookup = (n: number) => db.get(n);

/**
 * Mirror of the UI's slot-walker: walk a card's spec, ask the engine for the
 * legal targets of each slot, and let `chooser` place a selection into the
 * assembled `choices` — exactly how the targeting flow builds its dispatch.
 */
function assembleChoices(
  card: number,
  state: GameState,
  me: string,
  chooser: (slot: ChoiceSlot, legal: ReturnType<typeof legalTargets>, choices: Choices) => void,
): Choices {
  const spec = specFor(card);
  expect(spec).toBeDefined();
  const choices: Choices = {};
  for (const slot of spec!.slots) {
    const legal = legalTargets(slot, state, me, lookup);
    chooser(slot, legal, choices);
  }
  return choices;
}

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

describe('targeting flow assembles choices the engine accepts', () => {
  // A round is one turn per player, so we create the mood to target *within a
  // single turn*: Charity (#3) grants an additional play, letting p1 put a mood
  // on the board and then resolve a targeting card against it in the same turn.
  //
  // Deck is block-dealt: top 5 -> p1, next 5 -> p2 (see engine setup).
  //   p1: [3 Charity, 6 Conviction, 12 Faith, 30 blue, 108 green]
  const players = [
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
  ];

  function setup() {
    const engine = new Engine(db);
    const deck = [
      3, 6, 12, 30, 108, // p1 hand
      4, 27, 28, 29, 31, // p2 hand (fillers, never played)
      33, 34, 35, 36, 37, 38, 39, 40, // draw pile
    ];
    let state = engine.setup({ players, deck, firstPlayer: 'p1', preshuffled: true });
    // Charity grants an extra play, so p1 stays the active player (extra-mood).
    state = engine.apply(state, { type: 'play', player: 'p1', card: 3 });
    expect(state.activePlayer).toBe('p1');
    expect(state.phase).toBe('awaitingPlay');
    return { engine, get: () => state, set: (s: GameState) => (state = s) };
  }

  it('single-target (Conviction #6): remove a mood via specFor + legalTargets', () => {
    const { engine, get, set } = setup();

    expect(playsImmediately(6)).toBe(false);
    expect(isSingleTarget(specFor(6)!)).toBe(true);

    // The Charity mood p1 just played is the only mood in play — target it.
    const victim = (get().moods.p1 ?? []).find((m) => m.card === 3)!.uid;

    // Walk Conviction's single mood slot; its legal targets include the victim.
    const choices = assembleChoices(6, get(), 'p1', (slot, legal, out) => {
      if (slot.kind === 'mood') {
        expect(legal.moods).toContain(victim);
        out.moods = [victim];
      }
    });
    expect(choices).toEqual({ moods: [victim] });

    set(engine.apply(get(), { type: 'play', player: 'p1', card: 6, choices }));

    // The chosen mood left play (its owner bottom-decked it and drew).
    expect((get().moods.p1 ?? []).some((m) => m.uid === victim)).toBe(false);
    // Conviction itself entered p1's moods.
    expect((get().moods.p1 ?? []).some((m) => m.card === 6)).toBe(true);
  });

  it('multi-slot (Faith #12): discard a green/blue card AND suppress a mood', () => {
    const { engine, get, set } = setup();

    expect(isSingleTarget(specFor(12)!)).toBe(false);
    expect(specFor(12)!.slots).toHaveLength(2);

    const victim = (get().moods.p1 ?? []).find((m) => m.card === 3)!.uid;

    // Walk both slots: a green/blue hand card to discard, then a mood to suppress.
    const choices = assembleChoices(12, get(), 'p1', (slot, legal, out) => {
      if (slot.kind === 'handCard') {
        expect(legal.cards).toContain(30); // only the blue card (#30) qualifies
        out.cards = [30];
      } else if (slot.kind === 'mood') {
        expect(legal.moods).toContain(victim);
        out.moods = [victim];
      }
    });
    expect(choices.cards).toEqual([30]);
    expect(choices.moods).toEqual([victim]);

    set(engine.apply(get(), { type: 'play', player: 'p1', card: 12, choices }));

    // The blue card was discarded from hand; the chosen mood is suppressed to 0.
    expect(get().hands.p1).not.toContain(30);
    expect(get().discard).toContain(30);
    const suppressed = (get().moods.p1 ?? []).find((m) => m.uid === victim)!;
    expect(suppressed.suppressed).not.toBe('none');
    expect(suppressed.currentValue).toBe(0);
  });
});
